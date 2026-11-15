
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";

// Every collection belongs to one organisation.
function orgCollection(orgId, collectionName) {
  return collection(db, "organizations", orgId, collectionName);
}

// Load all data belonging to an organisation.
export async function loadWorkspaceData(orgId) {
  if (!orgId) throw new Error("Organisation ID is required.");

  const [
    wasteSnapshot,
    processorSnapshot,
    collectionSnapshot,
    certificateSnapshot,
  ] = await Promise.all([
    getDocs(query(orgCollection(orgId, "wasteRecords"), orderBy("date", "desc"))),
    getDocs(query(orgCollection(orgId, "processors"), orderBy("createdAt", "asc"))),
    getDocs(query(orgCollection(orgId, "collections"), orderBy("date", "desc"))),
    getDocs(query(orgCollection(orgId, "certificates"), orderBy("issueDate", "desc"))),
  ]);

  return {
    records: wasteSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })),

    processors: processorSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })),

    collections: collectionSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })),

    certificates: certificateSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
      complianceYear: String(item.data().complianceYear),
    })),
  };
}

// Add a waste record.
export async function addWasteRecord(orgId, formData) {
  const amount = Number(formData.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Waste quantity must be greater than zero.");
  }

  return addDoc(orgCollection(orgId, "wasteRecords"), {
    date: formData.date,
    type: formData.type,
    amount,
    collectedAmount: 0,
    status: "Pending",
    notes: formData.notes.trim(),
    createdAt: serverTimestamp(),
  });
}

// Register a waste processor.
export async function addProcessor(orgId, processorData) {
  if (!processorData.name.trim()) {
    throw new Error("Processor name is required.");
  }

  return addDoc(orgCollection(orgId, "processors"), {
    name: processorData.name.trim(),
    contact: processorData.contact.trim(),
    phone: processorData.phone.trim(),
    address: processorData.address.trim(),
    method: processorData.method,
    acceptedWaste: processorData.acceptedWaste,
    createdAt: serverTimestamp(),
  });
}

// Register a certificate entered by the organisation.
export async function addCertificate(orgId, certificateData) {
  const certificateNumber = certificateData.certificateNumber.trim();
  const quantity = Number(certificateData.quantity);

  if (!certificateNumber || !certificateData.issuer.trim()) {
    throw new Error("Certificate number and issuer are required.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Certificate quantity must be greater than zero.");
  }

  const certificatesRef = orgCollection(orgId, "certificates");

  const existing = await getDocs(
    query(certificatesRef)
  );

  const duplicate = existing.docs.some(
    (item) =>
      item.data().certificateNumberLower === certificateNumber.toLowerCase()
  );

  if (duplicate) {
    throw new Error("A certificate with this number is already registered.");
  }

  return addDoc(certificatesRef, {
    certificateNumber,
    certificateNumberLower: certificateNumber.toLowerCase(),
    issuer: certificateData.issuer.trim(),
    issueDate: certificateData.issueDate,
    complianceYear: Number(certificateData.complianceYear),
    quantity,
    reference: certificateData.reference.trim(),
    notes: certificateData.notes.trim(),
    createdAt: serverTimestamp(),
  });
}

// Record a pickup and update the waste record atomically.
export async function recordPickup(orgId, pickupData) {
  const wasteRef = doc(
    db,
    "organizations",
    orgId,
    "wasteRecords",
    pickupData.wasteRecordId
  );

  const processorRef = doc(
    db,
    "organizations",
    orgId,
    "processors",
    pickupData.processorId
  );

  const collectionRef = doc(orgCollection(orgId, "collections"));

  const amount = Number(pickupData.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Pickup quantity must be greater than zero.");
  }

  await runTransaction(db, async (transaction) => {
    const [wasteSnapshot, processorSnapshot] = await Promise.all([
      transaction.get(wasteRef),
      transaction.get(processorRef),
    ]);

    if (!wasteSnapshot.exists()) {
      throw new Error("Waste record not found.");
    }

    if (!processorSnapshot.exists()) {
      throw new Error("Processor not found.");
    }

    const waste = wasteSnapshot.data();
    const processor = processorSnapshot.data();

    const remaining = Number(waste.amount) - Number(waste.collectedAmount || 0);

    if (amount > remaining) {
      throw new Error("Pickup quantity exceeds the remaining waste quantity.");
    }

    if (!processor.acceptedWaste?.includes(waste.type)) {
      throw new Error("This processor does not accept this waste category.");
    }

    const newCollectedAmount = Number(waste.collectedAmount || 0) + amount;

    transaction.update(wasteRef, {
      collectedAmount: newCollectedAmount,
      status:
        newCollectedAmount >= Number(waste.amount)
          ? "Collected"
          : "Partial",
      lastCollectionId: collectionRef.id,
    });

    transaction.set(collectionRef, {
      wasteRecordId: wasteSnapshot.id,
      wasteDate: waste.date,
      wasteType: waste.type,
      date: pickupData.date,
      amount,
      collector: pickupData.collector.trim(),
      reference: pickupData.reference.trim(),
      processorId: processorSnapshot.id,
      processorName: processor.name,
      createdAt: serverTimestamp(),
    });
  });
}
