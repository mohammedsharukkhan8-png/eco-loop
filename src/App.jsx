
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  LayoutDashboard,
  Recycle,
  ClipboardList,
  Truck,
  Building2,
  FileCheck,
  BarChart3,
  Award,
  CalendarDays,
  Download,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Settings,
  Bell,
  Plus,
  ArrowUpRight,
  Leaf,
  Menu,
  X,
} from "lucide-react";

import "./App.css";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Waste Logs", icon: ClipboardList },
  { name: "Collections", icon: Truck },
  { name: "Processors", icon: Building2 },
  { name: "Compliance", icon: FileCheck },
  { name: "Reports", icon: BarChart3 },
];

const wasteData = [
  { day: "Mon", amount: 65 },
  { day: "Tue", amount: 82 },
  { day: "Wed", amount: 55 },
  { day: "Thu", amount: 95 },
  { day: "Fri", amount: 72 },
  { day: "Sat", amount: 110 },
  { day: "Sun", amount: 88 },
];

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function WasteTable({ records }) {
  if (records.length === 0) {
    return (
      <p className="no-records">
        No waste records yet. Add your first record.
      </p>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Waste Type</th>
            <th>Quantity</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{formatDate(record.date)}</td>
              <td>{record.type}</td>
              <td>{record.amount} kg</td>
              <td>
                <span className={`status ${record.status.toLowerCase()}`}>
                  {record.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [dataError, setDataError] = useState("");
  const [activePage, setActivePage] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [showProcessorForm, setShowProcessorForm] = useState(false);
  const [showCertificateForm, setShowCertificateForm] = useState(false);
  const [certificates, setCertificates] = useState([]);
  const [reportStart, setReportStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [reportEnd, setReportEnd] = useState(getToday());
  const [certificateData, setCertificateData] = useState({
    certificateNumber: "",
    issuer: "",
    issueDate: getToday(),
    complianceYear: String(new Date().getFullYear()),
    quantity: "",
    reference: "",
    notes: "",
  });
  const [processors, setProcessors] = useState([]);
  const [processorData, setProcessorData] = useState({
    name: "",
    contact: "",
    phone: "",
    address: "",
    method: "Composting",
    acceptedWaste: ["Wet Waste"],
  });
  const [records, setRecords] = useState([]);
  const [collections, setCollections] = useState([]);

  const [pickupData, setPickupData] = useState({
    wasteRecordId: "",
    date: getToday(),
    amount: "",
    collector: "",
    reference: "",
  });

  const [formData, setFormData] = useState({
    date: getToday(),
    type: "Wet Waste",
    amount: "",
    notes: "",
  });

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setAuthMessage(error.message);
      setSession(data?.session ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function loadWorkspaceData() {
    if (!session?.user?.id) return;
    setDataLoading(true);
    setDataError("");
    const [wasteResult, processorResult, collectionResult, certificateResult] = await Promise.all([
      supabase.from("waste_records").select("*").order("date", { ascending: false }),
      supabase.from("processors").select("*").order("created_at", { ascending: true }),
      supabase.from("collections").select("*").order("date", { ascending: false }),
      supabase.from("certificates").select("*").order("issue_date", { ascending: false }),
    ]);
    const failed = [wasteResult, processorResult, collectionResult, certificateResult].find((result) => result.error);
    if (failed) {
      setDataError(failed.error.message);
      setDataLoading(false);
      return;
    }
    setRecords((wasteResult.data || []).map((row) => ({
      id: row.id, date: row.date, type: row.type, amount: Number(row.amount),
      collectedAmount: Number(row.collected_amount || 0), status: row.status, notes: row.notes || "",
    })));
    setProcessors((processorResult.data || []).map((row) => ({
      id: row.id, name: row.name, contact: row.contact || "", phone: row.phone || "",
      address: row.address || "", method: row.method, acceptedWaste: row.accepted_waste || [],
    })));
    setCollections((collectionResult.data || []).map((row) => ({
      id: row.id, wasteRecordId: row.waste_record_id, wasteDate: row.waste_date,
      wasteType: row.waste_type, date: row.date, amount: Number(row.amount),
      collector: row.collector || "", reference: row.reference || "",
      processorId: row.processor_id, processorName: row.processor_name || "",
    })));
    setCertificates((certificateResult.data || []).map((row) => ({
      id: row.id, certificateNumber: row.certificate_number, issuer: row.issuer,
      issueDate: row.issue_date, complianceYear: String(row.compliance_year),
      quantity: Number(row.quantity), reference: row.reference || "", notes: row.notes || "",
    })));
    setDataLoading(false);
  }

  useEffect(() => {
    if (session?.user?.id) loadWorkspaceData();
    else {
      setRecords([]); setCollections([]); setProcessors([]); setCertificates([]);
    }
  }, [session?.user?.id]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthBusy(true); setAuthMessage("");
    const action = authMode === "login"
      ? supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword })
      : supabase.auth.signUp({ email: authEmail.trim(), password: authPassword });
    const { data, error } = await action;
    if (error) setAuthMessage(error.message);
    else if (authMode === "signup" && !data.session) setAuthMessage("Account created. Check your email to confirm your address, then sign in.");
    else setAuthMessage(authMode === "signup" ? "Account created successfully." : "Signed in successfully.");
    setAuthBusy(false);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
  }

  // Calculate statistics from the records
  const totalWaste = records.reduce(
    (total, record) => total + record.amount,
    0
  );

  const wetWaste = records
    .filter((record) => record.type === "Wet Waste")
    .reduce((total, record) => total + record.amount, 0);

  const collectedWaste = records.reduce(
    (total, record) => total + (record.collectedAmount || 0),
    0
  );

  const pendingWaste = totalWaste - collectedWaste;
  const pendingRecords = records.filter(
    (record) => record.amount > (record.collectedAmount || 0)
  );

  const selectedWasteRecord = records.find(
    (record) => record.id === pickupData.wasteRecordId
  );

  const remainingQuantity = selectedWasteRecord
    ? selectedWasteRecord.amount - (selectedWasteRecord.collectedAmount || 0)
    : 0;

  const eligibleProcessors = selectedWasteRecord
    ? processors.filter((processor) =>
        processor.acceptedWaste.includes(selectedWasteRecord.type)
      )
    : [];

  const processorTotals = processors.map((processor) => {
    const linkedCollections = collections.filter(
      (collection) => collection.processorId === processor.id
    );
    return {
      ...processor,
      pickupCount: linkedCollections.length,
      receivedAmount: linkedCollections.reduce(
        (total, collection) => total + collection.amount,
        0
      ),
    };
  });

  const totalCertificateQuantity = certificates.reduce(
    (total, certificate) => total + certificate.quantity,
    0
  );

  const wetWasteCollected = collections
    .filter((collection) => collection.wasteType === "Wet Waste")
    .reduce((total, collection) => total + collection.amount, 0);

  // Reporting data is derived from the records already stored in this session.
  const reportRecords = records.filter((record) => record.date >= reportStart && record.date <= reportEnd);
  const reportCollections = collections.filter((item) => item.date >= reportStart && item.date <= reportEnd);
  const reportCertificates = certificates.filter((item) => item.issueDate >= reportStart && item.issueDate <= reportEnd);
  const reportGenerated = reportRecords.reduce((sum, item) => sum + item.amount, 0);
  const reportCollectedFromLogs = reportRecords.reduce((sum, item) => sum + (item.collectedAmount || 0), 0);
  const reportPickupQuantity = reportCollections.reduce((sum, item) => sum + item.amount, 0);
  const reportWetGenerated = reportRecords.filter((item) => item.type === "Wet Waste").reduce((sum, item) => sum + item.amount, 0);
  const reportDryGenerated = reportRecords.filter((item) => item.type === "Dry Waste").reduce((sum, item) => sum + item.amount, 0);
  const reportPending = Math.max(0, reportGenerated - reportCollectedFromLogs);
  const reportCertificateQuantity = reportCertificates.reduce((sum, item) => sum + item.quantity, 0);
  const reportProcessorGroups = processors.map((processor) => ({
    ...processor,
    quantity: reportCollections.filter((item) => item.processorId === processor.id).reduce((sum, item) => sum + item.amount, 0),
    pickups: reportCollections.filter((item) => item.processorId === processor.id).length,
  })).filter((item) => item.pickups > 0);
  const reportMissingProcessor = reportCollections.filter((item) => !item.processorId || !item.processorName).length;

  function exportReportCsv() {
    const rows = [
      ["Ecoloop Environmental Performance Report"],
      ["Reporting period", reportStart, reportEnd],
      [],
      ["Metric", "Value", "Unit", "Source / interpretation"],
      ["Waste generated", reportGenerated, "kg", "Sum of waste log entries in selected period"],
      ["Wet waste generated", reportWetGenerated, "kg", "Wet Waste log entries"],
      ["Dry waste generated", reportDryGenerated, "kg", "Dry Waste log entries"],
      ["Quantity recorded as collected", reportCollectedFromLogs, "kg", "Collected amounts against waste logs; not proof of processing"],
      ["Pickup quantity linked to processors", reportPickupQuantity, "kg", "Collection events linked to a registered processor"],
      ["Pending collection", reportPending, "kg", "Generated quantity less quantity marked collected"],
      ["Certificates entered in period", reportCertificates.length, "records", "User-entered register; not independently validated"],
      ["Certificate quantity entered", reportCertificateQuantity, "kg", "Quantity on certificates issued within selected period"],
      [],
      ["Processor", "Processing method", "Pickup events", "Pickup quantity (kg)"],
      ...reportProcessorGroups.map((item) => [item.name, item.method, item.pickups, item.quantity]),
      [],
      ["Data limitations", "Pickup records show recorded handover/pickup only; downstream processing is not independently confirmed by Ecoloop."],
      ["Data limitations", "Certificate details are self-entered and are not validated, issued or certified by Ecoloop."],
      ["Data limitations", "This is an environmental operations report, not a complete ESG report, ESG rating, legal-compliance opinion or assurance statement."],
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ecoloop-environmental-report-${reportStart}-to-${reportEnd}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const collectionPercentage =
    totalWaste === 0
      ? 0
      : Math.round((collectedWaste / totalWaste) * 100);

  const stats = [
    {
      title: "Total Waste",
      value: `${totalWaste} kg`,
      change: "Total recorded waste",
      icon: Recycle,
    },
    {
      title: "Wet Waste",
      value: `${wetWaste} kg`,
      change: `${totalWaste ? ((wetWaste / totalWaste) * 100).toFixed(1) : 0}% of total`,
      icon: Leaf,
    },
    {
      title: "Collected Waste",
      value: `${collectedWaste} kg`,
      change: `${collectionPercentage}% collected`,
      icon: Truck,
    },
    {
      title: "Pending Pickup",
      value: `${pendingWaste} kg`,
      change: "Awaiting collection",
      icon: ClipboardList,
    },
  ];

  function handleInputChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function openWasteForm() {
    setFormData({
      date: getToday(),
      type: "Wet Waste",
      amount: "",
      notes: "",
    });

    setShowForm(true);
    setMenuOpen(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const quantity = Number(formData.amount);

    if (
      !formData.date ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      alert("Please enter a valid date and a quantity greater than zero.");
      return;
    }

    const { error } = await supabase.from("waste_records").insert({
      date: formData.date, type: formData.type, amount: quantity,
      collected_amount: 0, status: "Pending", notes: formData.notes.trim(),
    });
    if (error) { alert(`Could not save waste record: ${error.message}`); return; }
    await loadWorkspaceData();
    setShowForm(false);
  }

  function openCollectionForm() {
    if (pendingRecords.length === 0) {
      alert("There are no pending quantities to collect.");
      return;
    }

    setPickupData({
      wasteRecordId: String(pendingRecords[0].id),
      date: getToday(),
      amount: "",
      collector: "",
      reference: "",
      processorId: "",
    });
    setShowCollectionForm(true);
    setMenuOpen(false);
  }

  function handlePickupInputChange(event) {
    const { name, value } = event.target;
    setPickupData((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "wasteRecordId" ? { amount: "", processorId: "" } : {}),
    }));
  }

  function handleProcessorInputChange(event) {
    const { name, value } = event.target;
    setProcessorData((previous) => ({ ...previous, [name]: value }));
  }

  function toggleAcceptedWaste(wasteType) {
    setProcessorData((previous) => ({
      ...previous,
      acceptedWaste: previous.acceptedWaste.includes(wasteType)
        ? previous.acceptedWaste.filter((item) => item !== wasteType)
        : [...previous.acceptedWaste, wasteType],
    }));
  }

  async function handleProcessorSubmit(event) {
    event.preventDefault();
    if (!processorData.name.trim()) {
      alert("Please enter the processor name.");
      return;
    }
    if (processorData.acceptedWaste.length === 0) {
      alert("Select at least one accepted waste category.");
      return;
    }

    const { error } = await supabase.from("processors").insert({
      name: processorData.name.trim(), contact: processorData.contact.trim(),
      phone: processorData.phone.trim(), address: processorData.address.trim(),
      method: processorData.method, accepted_waste: processorData.acceptedWaste,
    });
    if (error) { alert(`Could not save processor: ${error.message}`); return; }
    await loadWorkspaceData();
    setProcessorData({
      name: "",
      contact: "",
      phone: "",
      address: "",
      method: "Composting",
      acceptedWaste: ["Wet Waste"],
    });
    setShowProcessorForm(false);
  }

  function handleCertificateInputChange(event) {
    const { name, value } = event.target;
    setCertificateData((previous) => ({ ...previous, [name]: value }));
  }

  function openCertificateForm() {
    setCertificateData({
      certificateNumber: "",
      issuer: "",
      issueDate: getToday(),
      complianceYear: String(new Date().getFullYear()),
      quantity: "",
      reference: "",
      notes: "",
    });
    setShowCertificateForm(true);
    setMenuOpen(false);
  }

  async function handleCertificateSubmit(event) {
    event.preventDefault();
    const quantity = Number(certificateData.quantity);
    const certificateNumber = certificateData.certificateNumber.trim();

    if (!certificateNumber || !certificateData.issuer.trim() ||
        !certificateData.issueDate || !certificateData.complianceYear ||
        !Number.isFinite(quantity) || quantity <= 0) {
      alert("Enter the certificate number, issuer, date, compliance year and a valid quantity.");
      return;
    }

    if (certificates.some((item) => item.certificateNumber.toLowerCase() === certificateNumber.toLowerCase())) {
      alert("A certificate with this number is already registered.");
      return;
    }

    const { error } = await supabase.from("certificates").insert({
      certificate_number: certificateNumber, issuer: certificateData.issuer.trim(),
      issue_date: certificateData.issueDate, compliance_year: Number(certificateData.complianceYear),
      quantity, reference: certificateData.reference.trim(), notes: certificateData.notes.trim(),
    });
    if (error) { alert(`Could not save certificate: ${error.message}`); return; }
    await loadWorkspaceData();
    setShowCertificateForm(false);
  }

  async function handlePickupSubmit(event) {
    event.preventDefault();

    const quantity = Number(pickupData.amount);
    const record = records.find(
      (item) => item.id === pickupData.wasteRecordId
    );
    const remaining = record
      ? record.amount - (record.collectedAmount || 0)
      : 0;

    const receivingProcessor = processors.find(
      (processor) => processor.id === pickupData.processorId
    );

    if (!record || !pickupData.date || !Number.isFinite(quantity) ||
        quantity <= 0 || quantity > remaining) {
      alert("Enter a valid pickup quantity that does not exceed the remaining amount.");
      return;
    }
    if (!receivingProcessor || !receivingProcessor.acceptedWaste.includes(record.type)) {
      alert("Select a registered processor that accepts this waste category.");
      return;
    }

    const { error } = await supabase.rpc("record_pickup", {
      p_waste_record_id: record.id,
      p_processor_id: receivingProcessor.id,
      p_date: pickupData.date,
      p_amount: quantity,
      p_collector: pickupData.collector.trim(),
      p_reference: pickupData.reference.trim(),
    });
    if (error) { alert(`Could not record pickup: ${error.message}`); return; }
    await loadWorkspaceData();
    setShowCollectionForm(false);
  }

  if (authLoading) return <div className="auth-screen"><div className="auth-card"><h1>ecoloop</h1><p>Checking your session…</p></div></div>;

  if (!session) return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleAuthSubmit}>
        <div className="auth-brand"><Recycle size={28}/><span>ecoloop</span></div>
        <p className="auth-kicker">WASTE INTELLIGENCE</p>
        <h1>{authMode === "login" ? "Welcome back" : "Create your workspace account"}</h1>
        <p className="auth-description">Sign in to securely access your waste records, collections, processors, certificates and reports.</p>
        <label htmlFor="auth-email">Email address</label>
        <input id="auth-email" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required autoComplete="email" />
        <label htmlFor="auth-password">Password</label>
        <input id="auth-password" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required minLength={6} autoComplete={authMode === "login" ? "current-password" : "new-password"} />
        {authMessage && <p className="auth-message">{authMessage}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}</button>
        <button className="auth-switch" type="button" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthMessage(""); }}>{authMode === "login" ? "New to Ecoloop? Create an account" : "Already have an account? Sign in"}</button>
      </form>
    </div>
  );

  return (
    <div className="app-layout">

      {/* Mobile menu button */}
      <button
        className="mobile-menu"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        {menuOpen ? <X /> : <Menu />}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <Recycle size={25} />
          </div>

          <div>
            <h2>ecoloop</h2>
            <span>WASTE INTELLIGENCE</span>
          </div>
        </div>

        <p className="menu-label">MAIN MENU</p>

        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={`nav-item ${
                  activePage === item.name ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage(item.name);
                  setMenuOpen(false);
                }}
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item">
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="profile">
            <div className="avatar">{(session?.user?.email || "U").slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{session?.user?.email || "Workspace"}</strong>
              <span>Authenticated workspace</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {dataLoading && <div className="data-status">Syncing your workspace data…</div>}
        {dataError && <div className="data-error">Database error: {dataError}. Check your Supabase setup and table policies.</div>}

        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / {activePage}</p>
            <h1>{activePage}</h1>
          </div>

          <div className="topbar-right">
            <button
              className="notification-button"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span></span>
            </button>

            <span className="account-email">{session?.user?.email}</span>
            <button className="secondary-button signout-button" onClick={handleSignOut}>Sign out</button>
          </div>
        </header>

        {/* Dashboard */}
        {activePage === "Dashboard" && (
          <>
            <section className="welcome-section">
              <div>
                <h2>Welcome to Ecoloop 👋</h2>
                <p>Here's your waste management overview.</p>
              </div>

              <button
                className="primary-button"
                onClick={openWasteForm}
              >
                <Plus size={18} />
                Log Waste
              </button>
            </section>

            {/* Statistics */}
            <section className="stats-grid">
              {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div className="stat-card" key={stat.title}>
                    <div className="stat-top">
                      <span>{stat.title}</span>

                      <div className="stat-icon">
                        <Icon size={20} />
                      </div>
                    </div>

                    <h2>{stat.value}</h2>
                    <p>{stat.change}</p>
                  </div>
                );
              })}
            </section>

            {/* Analytics */}
            <section className="content-grid">

              <div className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Waste Generation</h3>
                    <p>Daily waste generated this week</p>
                  </div>

                  <span className="period-label">This week</span>
                </div>

                <div className="chart">
                  {wasteData.map((item) => (
                    <div className="chart-column" key={item.day}>
                      <div className="bar-wrapper">
                        <div
                          className="bar"
                          style={{
                            height: `${(item.amount / 110) * 100}%`,
                          }}
                          title={`${item.amount} kg`}
                        ></div>
                      </div>

                      <span>{item.day}</span>
                    </div>
                  ))}
                </div>

                <div className="chart-footer">
                  <span>Weekly total</span>
                  <strong>
                    {wasteData.reduce(
                      (total, item) => total + item.amount,
                      0
                    )} kg
                  </strong>
                </div>
              </div>

              {/* Collection overview */}
              <div className="panel collection-panel">
                <h3>Collection Overview</h3>
                <p>Waste collection progress</p>

                <div
                  className="progress-circle"
                  style={{
                    background: `conic-gradient(#176b50 0% ${collectionPercentage}%, #e7eee9 ${collectionPercentage}% 100%)`,
                  }}
                >
                  <div>
                    <strong>{collectionPercentage}%</strong>
                    <span>Collected</span>
                  </div>
                </div>

                <div className="legend">
                  <span>
                    <i className="green-dot"></i>
                    Collected: {collectedWaste} kg
                  </span>

                  <span>
                    <i className="orange-dot"></i>
                    Pending: {pendingWaste} kg
                  </span>
                </div>
              </div>
            </section>

            {/* Recent records */}
            <section className="panel records-panel">
              <div className="panel-heading">
                <div>
                  <h3>Recent Waste Records</h3>
                  <p>Your latest waste entries</p>
                </div>

                <button
                  className="text-button"
                  onClick={() => setActivePage("Waste Logs")}
                >
                  View all <ArrowUpRight size={15} />
                </button>
              </div>

              <WasteTable records={records.slice(0, 5)} />
            </section>
          </>
        )}

        {/* Waste Logs */}
        {activePage === "Waste Logs" && (
          <section className="panel records-panel">
            <div className="panel-heading">
              <div>
                <h3>All Waste Records</h3>
                <p>{records.length} records entered</p>
              </div>

              <button
                className="primary-button"
                onClick={openWasteForm}
              >
                <Plus size={18} />
                Log Waste
              </button>
            </div>

            <WasteTable records={records} />
          </section>
        )}

        {/* Collections */}
        {activePage === "Collections" && (
          <>
            <section className="welcome-section">
              <div>
                <h2>Pickup Management</h2>
                <p>Record and verify quantities collected from each waste log.</p>
              </div>
              <button
                className="primary-button"
                onClick={openCollectionForm}
                disabled={pendingRecords.length === 0}
              >
                <Plus size={18} />
                Record Pickup
              </button>
            </section>

            <section className="stats-grid">
              {[
                { title: "Total Pickups", value: collections.length, detail: "Verified pickup entries", icon: Truck },
                { title: "Collected", value: `${collectedWaste} kg`, detail: `${collectionPercentage}% of recorded waste`, icon: Recycle },
                { title: "Remaining", value: `${pendingWaste} kg`, detail: "Quantity not yet collected", icon: ClipboardList },
                { title: "Pending Records", value: pendingRecords.length, detail: "Waste logs awaiting pickup", icon: FileCheck },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div className="stat-card" key={stat.title}>
                    <div className="stat-top">
                      <span>{stat.title}</span>
                      <div className="stat-icon"><Icon size={20} /></div>
                    </div>
                    <h2>{stat.value}</h2>
                    <p>{stat.detail}</p>
                  </div>
                );
              })}
            </section>

            <section className="panel records-panel">
              <div className="panel-heading">
                <div>
                  <h3>Pickup History</h3>
                  <p>{collections.length} pickup entries recorded</p>
                </div>
              </div>

              {collections.length === 0 ? (
                <p className="no-records">
                  No pickups recorded yet. Select “Record Pickup” to verify your first collection.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Pickup Date</th>
                        <th>Waste Type</th>
                        <th>Quantity</th>
                        <th>Collector / Agency</th>
                        <th>Receiving Processor</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collections.map((item) => (
                        <tr key={item.id}>
                          <td>{formatDate(item.date)}</td>
                          <td>{item.wasteType}</td>
                          <td>{item.amount} kg</td>
                          <td>{item.collector || "—"}</td>
                          <td>{item.processorName || "—"}</td>
                          <td>{item.reference || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* Processor Management */}
        {activePage === "Processors" && (
          <>
            <section className="welcome-section">
              <div>
                <h2>Processor Directory</h2>
                <p>Manage facilities that receive and process your waste.</p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setProcessorData({
                    name: "",
                    contact: "",
                    phone: "",
                    address: "",
                    method: "Composting",
                    acceptedWaste: ["Wet Waste"],
                  });
                  setShowProcessorForm(true);
                }}
              >
                <Plus size={18} />
                Register Processor
              </button>
            </section>

            <section className="stats-grid">
              {[
                { title: "Registered Processors", value: processors.length, detail: "Facilities in your directory", icon: Building2 },
                { title: "Linked Pickups", value: collections.filter((item) => item.processorId).length, detail: "Pickups assigned to processors", icon: Truck },
                { title: "Linked Pickup Quantity", value: `${collections.reduce((sum, item) => sum + (item.processorId ? item.amount : 0), 0)} kg`, detail: "Quantity in linked pickup records", icon: Recycle },
                { title: "Processing Methods", value: new Set(processors.map((item) => item.method)).size, detail: "Methods represented", icon: Settings },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div className="stat-card" key={stat.title}>
                    <div className="stat-top">
                      <span>{stat.title}</span>
                      <div className="stat-icon"><Icon size={20} /></div>
                    </div>
                    <h2>{stat.value}</h2>
                    <p>{stat.detail}</p>
                  </div>
                );
              })}
            </section>

            {processorTotals.length === 0 ? (
              <section className="panel processor-empty">
                <Building2 size={34} />
                <h3>No processors registered</h3>
                <p>Add a composting or waste-processing facility to link it to future pickups.</p>
                <button className="primary-button" onClick={() => setShowProcessorForm(true)}>
                  <Plus size={17} /> Add First Processor
                </button>
              </section>
            ) : (
              <section className="processor-grid">
                {processorTotals.map((processor) => (
                  <article className="panel processor-card" key={processor.id}>
                    <div className="processor-card-top">
                      <div className="processor-symbol"><Building2 size={21} /></div>
                      <span className="method-badge">{processor.method}</span>
                    </div>
                    <h3>{processor.name}</h3>
                    <p className="processor-contact">{processor.contact || "Contact person not added"}</p>
                    <div className="accepted-waste">
                      {processor.acceptedWaste.map((type) => (
                        <span key={type}>{type}</span>
                      ))}
                    </div>
                    <div className="processor-details">
                      {processor.phone && <p><strong>Phone:</strong> {processor.phone}</p>}
                      {processor.address && <p><strong>Address:</strong> {processor.address}</p>}
                    </div>
                    <div className="processor-metrics">
                      <div><strong>{processor.pickupCount}</strong><span>Linked pickups</span></div>
                      <div><strong>{processor.receivedAmount} kg</strong><span>Quantity received</span></div>
                    </div>
                  </article>
                ))}
              </section>
            )}

            {processorTotals.length > 0 && (
              <section className="panel records-panel">
                <div className="panel-heading">
                  <div><h3>Processor-wise Summary</h3><p>Pickup quantities linked to each facility</p></div>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Processor</th><th>Method</th><th>Pickups</th><th>Quantity Received</th></tr></thead>
                    <tbody>
                      {processorTotals.map((processor) => (
                        <tr key={processor.id}>
                          <td>{processor.name}</td>
                          <td>{processor.method}</td>
                          <td>{processor.pickupCount}</td>
                          <td>{processor.receivedAmount} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {/* EBWGR Certificate Management */}
        {activePage === "Compliance" && (
          <>
            <section className="welcome-section">
              <div>
                <h2>EBWGR Certificate Register</h2>
                <p>Record certificates received or purchased and keep their details organised.</p>
              </div>
              <button className="primary-button" onClick={openCertificateForm}>
                <Plus size={18} /> Add Certificate
              </button>
            </section>

            <section className="compliance-note">
              <Award size={20} />
              <p><strong>Record keeping only:</strong> Ecoloop stores certificate details for tracking. It does not issue, validate, transfer or purchase EBWGR certificates.</p>
            </section>

            <section className="stats-grid">
              {[
                { title: "Certificates Recorded", value: certificates.length, detail: "Entries in this register", icon: FileCheck },
                { title: "Recorded Quantity", value: `${totalCertificateQuantity} kg`, detail: "Quantity on entered certificates", icon: Recycle },
                { title: "Wet Waste Generated", value: `${wetWaste} kg`, detail: "From your waste logs", icon: Leaf },
                { title: "Wet Waste Collected", value: `${wetWasteCollected} kg`, detail: "From verified pickup records", icon: Truck },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div className="stat-card" key={stat.title}>
                    <div className="stat-top"><span>{stat.title}</span><div className="stat-icon"><Icon size={20} /></div></div>
                    <h2>{stat.value}</h2>
                    <p>{stat.detail}</p>
                  </div>
                );
              })}
            </section>

            <section className="panel records-panel">
              <div className="panel-heading">
                <div><h3>Certificate History</h3><p>{certificates.length} certificate records saved</p></div>
              </div>
              {certificates.length === 0 ? (
                <div className="certificate-empty">
                  <Award size={32} />
                  <h3>No certificates recorded</h3>
                  <p>Add the details of an EBWGR certificate to start your register.</p>
                  <button className="primary-button" onClick={openCertificateForm}><Plus size={17} /> Add First Certificate</button>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Certificate No.</th><th>Issuer</th><th>Issue Date</th><th>Compliance Year</th><th>Quantity</th><th>Reference</th></tr></thead>
                    <tbody>
                      {certificates.map((certificate) => (
                        <tr key={certificate.id}>
                          <td><strong>{certificate.certificateNumber}</strong></td>
                          <td>{certificate.issuer}</td>
                          <td>{formatDate(certificate.issueDate)}</td>
                          <td>{certificate.complianceYear}</td>
                          <td>{certificate.quantity} kg</td>
                          <td>{certificate.reference || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {certificates.length > 0 && (
              <section className="panel records-panel certificate-notes-panel">
                <div className="panel-heading"><div><h3>Certificate Notes</h3><p>Additional information saved with each entry</p></div></div>
                {certificates.map((certificate) => (
                  <div className="certificate-note-row" key={certificate.id}>
                    <strong>{certificate.certificateNumber}</strong>
                    <span>{certificate.notes || "No additional notes"}</span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {activePage === "Reports" && (
          <div className="report-page">
            <section className="welcome-section report-toolbar">
              <div><h2>Environmental Impact & ESG Reporting</h2><p>Evidence-based waste performance reporting from your Ecoloop records.</p></div>
              <div className="report-actions no-print">
                <button className="secondary-button" onClick={exportReportCsv}><Download size={17} /> Export CSV</button>
                <button className="primary-button" onClick={() => window.print()}><Printer size={17} /> Print / Save PDF</button>
              </div>
            </section>

            <section className="report-period panel no-print">
              <div><label htmlFor="reportStart">From</label><input id="reportStart" type="date" value={reportStart} max={reportEnd} onChange={(event) => setReportStart(event.target.value)} /></div>
              <div><label htmlFor="reportEnd">To</label><input id="reportEnd" type="date" value={reportEnd} min={reportStart} max={getToday()} onChange={(event) => setReportEnd(event.target.value)} /></div>
              <p>Change the period to recalculate every metric below.</p>
            </section>

            <section className="report-document" id="ecoloop-report">
              <header className="report-document-header">
                <div className="report-brand"><span className="report-brand-mark"><Leaf size={22} /></span><div><strong>ecoloop</strong><small>WASTE INTELLIGENCE</small></div></div>
                <div className="report-heading"><span>ENVIRONMENTAL PERFORMANCE</span><h2>Waste Management Report</h2><p>{formatDate(reportStart)} – {formatDate(reportEnd)}</p></div>
              </header>

              <div className="report-disclaimer"><ShieldCheck size={19} /><p><strong>Evidence-first reporting.</strong> This report summarizes information entered into Ecoloop. It is not an ESG rating, legal-compliance determination, independent audit or assurance statement.</p></div>

              <section className="report-section">
                <h3>1. Performance at a glance</h3>
                <div className="report-metric-grid">
                  <div><strong>{reportGenerated.toLocaleString("en-IN")} kg</strong><span>Waste generated</span></div>
                  <div><strong>{reportWetGenerated.toLocaleString("en-IN")} kg</strong><span>Wet waste generated</span></div>
                  <div><strong>{reportDryGenerated.toLocaleString("en-IN")} kg</strong><span>Dry waste generated</span></div>
                  <div><strong>{reportCollectedFromLogs.toLocaleString("en-IN")} kg</strong><span>Marked as collected</span></div>
                  <div><strong>{reportPickupQuantity.toLocaleString("en-IN")} kg</strong><span>Processor-linked pickup records</span></div>
                  <div><strong>{reportPending.toLocaleString("en-IN")} kg</strong><span>Pending collection</span></div>
                </div>
                <p className="report-method-note">Collection percentage: {reportGenerated ? `${Math.round(reportCollectedFromLogs / reportGenerated * 100)}%` : "Not available (no waste logs)"}. Calculated as quantity marked collected divided by waste generated in the selected period.</p>
              </section>

              <section className="report-section">
                <h3>2. Collection and processor records</h3>
                {reportCollections.length === 0 ? <p className="report-empty">No pickup records were found in this reporting period.</p> : <div className="table-wrapper"><table><thead><tr><th>Pickup date</th><th>Waste type</th><th>Quantity</th><th>Processor</th><th>Processing method</th></tr></thead><tbody>{reportCollections.map((item) => { const processor = processors.find((entry) => entry.id === item.processorId); return <tr key={item.id}><td>{formatDate(item.date)}</td><td>{item.wasteType}</td><td>{item.amount} kg</td><td>{item.processorName || "Not linked"}</td><td>{processor?.method || "Not recorded"}</td></tr>; })}</tbody></table></div>}
                <p className="report-method-note">These entries document pickups linked to processors in the register. They do not independently prove receipt, treatment, recycling or final disposal at the facility.</p>
                {reportProcessorGroups.length > 0 && <div className="report-processor-summary">{reportProcessorGroups.map((item) => <div key={item.id}><strong>{item.name}</strong><span>{item.method} · {item.pickups} pickup(s) · {item.quantity} kg</span></div>)}</div>}
              </section>

              <section className="report-section">
                <h3>3. EBWGR certificate register summary</h3>
                <div className="report-certificate-summary"><strong>{reportCertificates.length} certificate record(s)</strong><strong>{reportCertificateQuantity.toLocaleString("en-IN")} kg entered quantity</strong></div>
                {reportCertificates.length > 0 ? <div className="table-wrapper"><table><thead><tr><th>Certificate number</th><th>Issuer</th><th>Issue date</th><th>Compliance year</th><th>Quantity</th></tr></thead><tbody>{reportCertificates.map((item) => <tr key={item.id}><td>{item.certificateNumber}</td><td>{item.issuer}</td><td>{formatDate(item.issueDate)}</td><td>{item.complianceYear}</td><td>{item.quantity} kg</td></tr>)}</tbody></table></div> : <p className="report-empty">No certificate issue dates fall within this reporting period.</p>}
                <p className="report-method-note">Certificate details and quantities are self-entered records. Ecoloop does not validate certificate authenticity, ownership, transfer, eligibility or sufficiency.</p>
              </section>

              <section className="report-section">
                <h3>4. Data quality and limitations</h3>
                <ul className="report-limitations">
                  <li>Metrics are calculated from records saved in this authenticated Ecoloop workspace for the selected reporting period. Data may be incomplete or inaccurate if entries are missing or incorrect.</li>
                  <li>Pickup records are evidence of recorded collection/handover, not independent confirmation of downstream processing.</li>
                  <li>Processor names and methods come from the organization's processor directory and are not independently audited.</li>
                  <li>Certificate records are not independently validated by Ecoloop.</li>
                  <li>No carbon-emissions reduction, avoided landfill, biodiversity, social-impact or overall ESG score is calculated in this report.</li>
                  <li>This report covers environmental waste operations only; it is not a complete ESG report and does not replace applicable statutory filings or independent assurance.</li>
                </ul>
              </section>

              <footer className="report-document-footer"><span>Generated by Ecoloop · {formatDate(getToday())}</span><span>Source: organization-entered Ecoloop records</span></footer>
            </section>
            <p className="report-storage-note no-print"><AlertTriangle size={16} /> Database-backed workspace: report values are calculated from saved Ecoloop entries. Source records remain organization-entered and are not independently audited.</p>
          </div>
        )}

        <footer>
          Ecoloop © 2026 · Waste compliance made simple.
        </footer>
      </main>

      {/* Waste entry modal */}
      {showForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <div
            className="waste-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="waste-form-title"
          >
            <div className="modal-heading">
              <div>
                <h2 id="waste-form-title">Log New Waste</h2>
                <p>Enter your waste generation details.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label htmlFor="date">Waste Date</label>

              <input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleInputChange}
                required
              />

              <label htmlFor="type">Waste Category</label>

              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
              >
                <option value="Wet Waste">Wet Waste</option>
                <option value="Dry Waste">Dry Waste</option>
              </select>

              <label htmlFor="amount">Quantity (kg)</label>

              <input
                id="amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter quantity in kg"
                value={formData.amount}
                onChange={handleInputChange}
                required
              />

              <label htmlFor="notes">Notes (optional)</label>

              <textarea
                id="notes"
                name="notes"
                rows="3"
                placeholder="Example: Kitchen vegetable leftovers"
                value={formData.notes}
                onChange={handleInputChange}
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button">
                  <Plus size={17} />
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pickup verification modal */}
      {showCollectionForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCollectionForm(false);
            }
          }}
        >
          <div
            className="waste-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pickup-form-title"
          >
            <div className="modal-heading">
              <div>
                <h2 id="pickup-form-title">Verify Waste Pickup</h2>
                <p>Enter the quantity confirmed by the collector or agency.</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowCollectionForm(false)}
                aria-label="Close form"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handlePickupSubmit}>
              <label htmlFor="wasteRecordId">Waste Record</label>
              <select
                id="wasteRecordId"
                name="wasteRecordId"
                value={pickupData.wasteRecordId}
                onChange={handlePickupInputChange}
                required
              >
                {pendingRecords.map((record) => {
                  const remaining = record.amount - (record.collectedAmount || 0);
                  return (
                    <option key={record.id} value={record.id}>
                      {formatDate(record.date)} · {record.type} · {remaining} kg remaining
                    </option>
                  );
                })}
              </select>

              <p className="remaining-hint">
                Remaining quantity for this record: <strong>{remainingQuantity} kg</strong>
              </p>

              <label htmlFor="processorId">Receiving Processor</label>
              <select
                id="processorId"
                name="processorId"
                value={pickupData.processorId}
                onChange={handlePickupInputChange}
                required
                disabled={eligibleProcessors.length === 0}
              >
                <option value="">Select a compatible processor</option>
                {eligibleProcessors.map((processor) => (
                  <option key={processor.id} value={processor.id}>{processor.name} · {processor.method}</option>
                ))}
              </select>
              {eligibleProcessors.length === 0 && (
                <p className="processor-warning">
                  No registered processor accepts this waste type. Register a compatible processor first.
                </p>
              )}

              <label htmlFor="pickupDate">Pickup Date</label>
              <input
                id="pickupDate"
                name="date"
                type="date"
                value={pickupData.date}
                onChange={handlePickupInputChange}
                required
              />

              <label htmlFor="pickupAmount">Collected Quantity (kg)</label>
              <input
                id="pickupAmount"
                name="amount"
                type="number"
                min="0.01"
                max={remainingQuantity}
                step="0.01"
                placeholder="Enter confirmed quantity"
                value={pickupData.amount}
                onChange={handlePickupInputChange}
                required
              />

              <label htmlFor="collector">Collector / Agency Name</label>
              <input
                id="collector"
                name="collector"
                type="text"
                placeholder="Enter collector or agency name"
                value={pickupData.collector}
                onChange={handlePickupInputChange}
                required
              />

              <label htmlFor="reference">Receipt / Reference ID (optional)</label>
              <input
                id="reference"
                name="reference"
                type="text"
                placeholder="Example: PICKUP-001"
                value={pickupData.reference}
                onChange={handlePickupInputChange}
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowCollectionForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  <FileCheck size={17} />
                  Verify Pickup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Processor registration modal */}
      {showProcessorForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowProcessorForm(false);
          }}
        >
          <div className="waste-modal" role="dialog" aria-modal="true" aria-labelledby="processor-form-title">
            <div className="modal-heading">
              <div>
                <h2 id="processor-form-title">Register Processor</h2>
                <p>Add the facility that will receive and process your waste.</p>
              </div>
              <button className="modal-close" onClick={() => setShowProcessorForm(false)} aria-label="Close form">
                <X size={21} />
              </button>
            </div>
            <form onSubmit={handleProcessorSubmit}>
              <label htmlFor="processorName">Processor / Facility Name</label>
              <input id="processorName" name="name" value={processorData.name} onChange={handleProcessorInputChange} placeholder="Example: Green Earth Composting" required />

              <label htmlFor="processorContact">Contact Person (optional)</label>
              <input id="processorContact" name="contact" value={processorData.contact} onChange={handleProcessorInputChange} placeholder="Enter contact person" />

              <label htmlFor="processorPhone">Phone Number (optional)</label>
              <input id="processorPhone" name="phone" type="tel" value={processorData.phone} onChange={handleProcessorInputChange} placeholder="Enter phone number" />

              <label htmlFor="processorAddress">Facility Address (optional)</label>
              <textarea id="processorAddress" name="address" rows="2" value={processorData.address} onChange={handleProcessorInputChange} placeholder="Enter facility address" />

              <label htmlFor="processorMethod">Processing Method</label>
              <select id="processorMethod" name="method" value={processorData.method} onChange={handleProcessorInputChange}>
                <option>Composting</option>
                <option>Bio-methanation</option>
                <option>Recycling</option>
                <option>Material Recovery</option>
                <option>Other</option>
              </select>

              <label>Accepted Waste Categories</label>
              <div className="processor-checkboxes">
                {["Wet Waste", "Dry Waste"].map((type) => (
                  <label className="processor-checkbox" key={type}>
                    <input
                      type="checkbox"
                      checked={processorData.acceptedWaste.includes(type)}
                      onChange={() => toggleAcceptedWaste(type)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setShowProcessorForm(false)}>Cancel</button>
                <button type="submit" className="primary-button"><Plus size={17} /> Save Processor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EBWGR certificate entry modal */}
      {showCertificateForm && (
        <div className="modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowCertificateForm(false);
        }}>
          <div className="waste-modal" role="dialog" aria-modal="true" aria-labelledby="certificate-form-title">
            <div className="modal-heading">
              <div>
                <h2 id="certificate-form-title">Add EBWGR Certificate</h2>
                <p>Enter the details exactly as shown on the certificate.</p>
              </div>
              <button className="modal-close" onClick={() => setShowCertificateForm(false)} aria-label="Close form"><X size={21} /></button>
            </div>
            <form onSubmit={handleCertificateSubmit}>
              <label htmlFor="certificateNumber">Certificate Number</label>
              <input id="certificateNumber" name="certificateNumber" value={certificateData.certificateNumber} onChange={handleCertificateInputChange} placeholder="Enter certificate number" required />

              <label htmlFor="certificateIssuer">Issuing Facility / Organisation</label>
              <input id="certificateIssuer" name="issuer" value={certificateData.issuer} onChange={handleCertificateInputChange} placeholder="Name shown as issuer" required />

              <label htmlFor="certificateIssueDate">Issue Date</label>
              <input id="certificateIssueDate" name="issueDate" type="date" value={certificateData.issueDate} onChange={handleCertificateInputChange} required />

              <label htmlFor="certificateYear">Compliance Year</label>
              <input id="certificateYear" name="complianceYear" type="number" min="2020" max="2100" value={certificateData.complianceYear} onChange={handleCertificateInputChange} required />

              <label htmlFor="certificateQuantity">Certificate Quantity (kg)</label>
              <input id="certificateQuantity" name="quantity" type="number" min="0.01" step="0.01" value={certificateData.quantity} onChange={handleCertificateInputChange} placeholder="Enter quantity in kg" required />

              <label htmlFor="certificateReference">Purchase / Transaction Reference (optional)</label>
              <input id="certificateReference" name="reference" value={certificateData.reference} onChange={handleCertificateInputChange} placeholder="Enter transaction reference" />

              <label htmlFor="certificateNotes">Notes (optional)</label>
              <textarea id="certificateNotes" name="notes" rows="3" value={certificateData.notes} onChange={handleCertificateInputChange} placeholder="Add any relevant details" />

              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setShowCertificateForm(false)}>Cancel</button>
                <button type="submit" className="primary-button"><FileCheck size={17} /> Save Certificate</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
