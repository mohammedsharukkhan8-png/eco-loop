
import { readFileSync } from "node:fs";
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";

import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

const PROJECT_ID = "ecoloop-web-7c5c3";

let testEnv;

before(async () => {
  const rules = readFileSync("firestore.rules", "utf8");

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

async function seedOrganization(orgId, memberUid) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "organizations", orgId), {
      name: "Test Organisation",
      createdBy: memberUid,
      createdAt: Timestamp.now(),
    });

    await setDoc(
      doc(db, "organizations", orgId, "members", memberUid),
      {
        uid: memberUid,
        email: "member@example.com",
        role: "admin",
        joinedAt: Timestamp.now(),
      }
    );
  });
}

test("unauthenticated users cannot read organisation waste records", async () => {
  await seedOrganization("org1", "user1");

  const db = testEnv.unauthenticatedContext().firestore();

  await assertFails(
    getDoc(doc(db, "organizations/org1/wasteRecords/waste1"))
  );
});

test("organisation members can read their own organisation", async () => {
  await seedOrganization("org2", "user2");

  const db = testEnv.authenticatedContext("user2").firestore();

  await assertSucceeds(
    getDoc(doc(db, "organizations/org2"))
  );
});

test("users cannot read another organisation's data", async () => {
  await seedOrganization("org3", "user3");
  await seedOrganization("org4", "user4");

  const db = testEnv.authenticatedContext("user3").firestore();

  await assertFails(
    getDoc(doc(db, "organizations/org4"))
  );
});

test("members can create valid waste records", async () => {
  await seedOrganization("org5", "user5");

  const db = testEnv.authenticatedContext("user5").firestore();

  await assertSucceeds(
    setDoc(doc(db, "organizations/org5/wasteRecords/waste1"), {
      date: "2026-11-15",
      type: "Wet Waste",
      amount: 25,
      collectedAmount: 0,
      status: "Pending",
      notes: "",
      createdAt: Timestamp.now(),
    })
  );
});

test("members cannot create waste records with invalid waste types", async () => {
  await seedOrganization("org6", "user6");

  const db = testEnv.authenticatedContext("user6").firestore();

  await assertFails(
    setDoc(doc(db, "organizations/org6/wasteRecords/waste1"), {
      date: "2026-11-15",
      type: "Plastic",
      amount: 25,
      collectedAmount: 0,
      status: "Pending",
      notes: "",
      createdAt: Timestamp.now(),
    })
  );
});

test("members cannot update collected quantity without a matching pickup", async () => {
  await seedOrganization("org7", "user7");

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "organizations/org7/wasteRecords/waste1"),
      {
        date: "2026-11-15",
        type: "Wet Waste",
        amount: 25,
        collectedAmount: 0,
        status: "Pending",
        notes: "",
        createdAt: Timestamp.now(),
      }
    );
  });

  const db = testEnv.authenticatedContext("user7").firestore();

  await assertFails(
    setDoc(
      doc(db, "organizations/org7/wasteRecords/waste1"),
      {
        date: "2026-11-15",
        type: "Wet Waste",
        amount: 25,
        collectedAmount: 10,
        status: "Partial",
        notes: "",
        createdAt: Timestamp.now(),
        lastCollectionId: "collection1",
      }
    )
  );
});

test("organisation creation succeeds when all three documents are written together", async () => {
  const db = testEnv.authenticatedContext("creator1").firestore();

  const batch = writeBatch(db);
  const now = Timestamp.now();

  batch.set(doc(db, "organizations/neworg"), {
    name: "New Organisation",
    createdBy: "creator1",
    createdAt: now,
  });

  batch.set(doc(db, "organizations/neworg/members/creator1"), {
    uid: "creator1",
    email: "creator@example.com",
    role: "admin",
    joinedAt: now,
  });

  batch.set(doc(db, "users/creator1/memberships/neworg"), {
    organizationId: "neworg",
    organizationName: "New Organisation",
    role: "admin",
    joinedAt: now,
  });

  await assertSucceeds(batch.commit());
});


async function seedPickupData(orgId, uid, acceptedWaste = ["Wet Waste"]) {
  await seedOrganization(orgId, uid);

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(
      doc(db, `organizations/${orgId}/wasteRecords/waste1`),
      {
        date: "2026-11-15",
        type: "Wet Waste",
        amount: 25,
        collectedAmount: 0,
        status: "Pending",
        notes: "",
        createdAt: Timestamp.now(),
      }
    );

    await setDoc(
      doc(db, `organizations/${orgId}/processors/processor1`),
      {
        name: "Test Processor",
        contact: "Test Contact",
        phone: "1234567890",
        address: "Test Address",
        method: "Composting",
        acceptedWaste,
        createdAt: Timestamp.now(),
      }
    );
  });
}

test("valid pickup creates collection and updates waste atomically", async () => {
  await seedPickupData("pickup-valid", "user-valid");

  const db = testEnv.authenticatedContext("user-valid").firestore();

  const wasteRef = doc(
    db,
    "organizations/pickup-valid/wasteRecords/waste1"
  );

  const collectionRef = doc(
    db,
    "organizations/pickup-valid/collections/collection1"
  );

  const batch = writeBatch(db);

  batch.update(wasteRef, {
    collectedAmount: 10,
    status: "Partial",
    lastCollectionId: "collection1",
  });

  batch.set(collectionRef, {
    wasteRecordId: "waste1",
    wasteDate: "2026-11-15",
    wasteType: "Wet Waste",
    date: "2026-11-15",
    amount: 10,
    collector: "Test Collector",
    reference: "REF-001",
    processorId: "processor1",
    processorName: "Test Processor",
    createdAt: Timestamp.now(),
  });

  await assertSucceeds(batch.commit());

  const updatedWaste = await getDoc(wasteRef);

  assert.equal(updatedWaste.data().collectedAmount, 10);
  assert.equal(updatedWaste.data().status, "Partial");
});

test("pickup exceeding remaining quantity is rejected", async () => {
  await seedPickupData("pickup-excess", "user-excess");

  const db = testEnv.authenticatedContext("user-excess").firestore();

  const wasteRef = doc(
    db,
    "organizations/pickup-excess/wasteRecords/waste1"
  );

  const collectionRef = doc(
    db,
    "organizations/pickup-excess/collections/collection1"
  );

  const batch = writeBatch(db);

  batch.update(wasteRef, {
    collectedAmount: 30,
    status: "Collected",
    lastCollectionId: "collection1",
  });

  batch.set(collectionRef, {
    wasteRecordId: "waste1",
    wasteDate: "2026-11-15",
    wasteType: "Wet Waste",
    date: "2026-11-15",
    amount: 30,
    collector: "Test Collector",
    reference: "REF-002",
    processorId: "processor1",
    processorName: "Test Processor",
    createdAt: Timestamp.now(),
  });

  await assertFails(batch.commit());
});

test("processor cannot receive a waste category it does not accept", async () => {
  await seedPickupData("pickup-category", "user-category", ["Dry Waste"]);

  const db = testEnv.authenticatedContext("user-category").firestore();

  const wasteRef = doc(
    db,
    "organizations/pickup-category/wasteRecords/waste1"
  );

  const collectionRef = doc(
    db,
    "organizations/pickup-category/collections/collection1"
  );

  const batch = writeBatch(db);

  batch.update(wasteRef, {
    collectedAmount: 10,
    status: "Partial",
    lastCollectionId: "collection1",
  });

  batch.set(collectionRef, {
    wasteRecordId: "waste1",
    wasteDate: "2026-11-15",
    wasteType: "Wet Waste",
    date: "2026-11-15",
    amount: 10,
    collector: "Test Collector",
    reference: "REF-003",
    processorId: "processor1",
    processorName: "Test Processor",
    createdAt: Timestamp.now(),
  });

  await assertFails(batch.commit());
});
