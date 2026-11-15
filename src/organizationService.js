
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "./firebase";

// Create an organisation and make its creator the initial admin.
export async function createOrganization(user, organizationName) {
  if (!user?.uid) {
    throw new Error("You must be signed in to create an organisation.");
  }

  const name = organizationName.trim();

  if (!name) {
    throw new Error("Please enter an organisation name.");
  }

  // Generate a unique organisation document ID.
  const organizationRef = doc(collection(db, "organizations"));

  // Membership documents.
  const memberRef = doc(
    db,
    "organizations",
    organizationRef.id,
    "members",
    user.uid
  );

  const userMembershipRef = doc(
    db,
    "users",
    user.uid,
    "memberships",
    organizationRef.id
  );

  // Write all three documents atomically.
  const batch = writeBatch(db);

  batch.set(organizationRef, {
    name,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });

  batch.set(memberRef, {
    uid: user.uid,
    email: user.email || "",
    role: "admin",
    joinedAt: serverTimestamp(),
  });

  batch.set(userMembershipRef, {
    organizationId: organizationRef.id,
    organizationName: name,
    role: "admin",
    joinedAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    id: organizationRef.id,
    name,
    role: "admin",
  };
}

// Get all organisations the signed-in user belongs to.
export async function getUserOrganizations(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const membershipsRef = collection(
    db,
    "users",
    userId,
    "memberships"
  );

  const snapshot = await getDocs(membershipsRef);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}
