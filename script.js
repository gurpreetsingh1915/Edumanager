// --- DATABASE INITIALIZATION ---
const STU_KEY = 'stuData';
const TRANS_KEY = 'transData';
const EXP_KEY = 'expData';
const ATT_KEY = 'attendanceRegistry';

let students = JSON.parse(localStorage.getItem(STU_KEY)) || [];
let transactions = JSON.parse(localStorage.getItem(TRANS_KEY)) || [];
let expenses = JSON.parse(localStorage.getItem(EXP_KEY)) || [];
let attendanceRegistry = JSON.parse(localStorage.getItem(ATT_KEY)) || {};

let currentViewStudentId = null;
let currentCalDate = new Date();

window.onload = () => {
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    initSystem();

    // NEW: Check if opened from a QR Scan
    const urlParams = new URLSearchParams(window.location.search);
    const verifyId = urlParams.get('verify');
    if (verifyId) {
        // Switch to verify section and run the search
        showSection('verify-student', document.querySelector('[onclick*="verify-student"]'));
        document.getElementById('verifyInput').value = verifyId;
        verifyStudent();
    }
};

function initSystem() {
    updateAcademicStats();
    updateCourseDropdown();
    refreshStudentDropdown();
    renderEnrolmentTable();
    renderAttendance();
    updateFinancialSummary();
    renderTransactions();
}

function saveData() {
    localStorage.setItem(STU_KEY, JSON.stringify(students));
    localStorage.setItem(TRANS_KEY, JSON.stringify(transactions));
    localStorage.setItem(EXP_KEY, JSON.stringify(expenses));
    localStorage.setItem(ATT_KEY, JSON.stringify(attendanceRegistry));
}

// --- NAVIGATION ---
function showSection(id, btn) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');

    // Trigger specific renders
    if(id === 'enrolment') renderEnrolmentTable();
    if(id === 'attendance') renderAttendance();
}

// --- STUDENT ENROLMENT & FILTERING ---
function filterStudents() {
    const searchQuery = document.getElementById('studentSearch').value.toLowerCase();
    const courseQuery = document.getElementById('courseFilter').value;
    const statusQuery = document.getElementById('statusFilter').value; // Get Status Value

    const filtered = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery) || s.id.includes(searchQuery);
        const matchesCourse = (courseQuery === "All" || s.course === courseQuery);
        
        // Match status (default to 'Active' if status is missing in record)
        const currentStatus = s.status || "Active";
        const matchesStatus = (statusQuery === "All" || currentStatus === statusQuery);
        
        return matchesSearch && matchesCourse && matchesStatus;
    });

    // Update the tables with the triple-filtered list
    renderEnrolmentTable(filtered);
    renderAttendance(filtered);
}

function renderEnrolmentTable(dataToRender = students) {
    const list = document.getElementById('enrolmentList');
    if (!list) return;

    list.innerHTML = dataToRender.map(s => {
        // Define colors for different statuses
        let statusColor = "#64748b"; // Default Grey
        if (s.status === "Active") statusColor = "#22c55e";    // Green
        if (s.status === "Completed") statusColor = "#3b82f6"; // Blue
        if (s.status === "Dropped") statusColor = "#ef4444";   // Red

        return `
        <tr>
            <td>#${s.id}</td>
            <td><strong onclick="viewProfile('${s.id}')" style="cursor:pointer; color:#2563eb;">${s.name}</strong></td>
            <td>${s.course}</td>
            <td>${s.joiningDate}</td>
            <td>
                <span style="background: ${statusColor}15; color: ${statusColor}; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; border: 1px solid ${statusColor}30;">
                    ${s.status || 'Active'}
                </span>
            </td>
            <td>
                <button class="btn-primary" style="background:#059669; padding:5px 8px; font-size:11px;" onclick="printIdCard('${s.id}')">Print ID</button>
            </td>
            <td>
                <button class="btn-edit" onclick="openUpdateModal('${s.id}')">Edit</button>
            </td>
        </tr>`;
    }).join('');
}

// --- ATTENDANCE SYSTEM ---
function renderAttendance(dataToRender = students) {
    const selectedDate = document.getElementById('attendanceDate').value;
    const list = document.getElementById('attendanceList');
    if (!list) return;
    const dayRecord = attendanceRegistry[selectedDate] || {};

    list.innerHTML = dataToRender.map(s => {
        const currentStatus = dayRecord[s.id] || "Absent";
        const color = currentStatus === "Present" ? "#22c55e" : (currentStatus === "Holiday" ? "#3b82f6" : "#ef4444");

        // Duration Alert Logic
        const joinDate = new Date(s.joiningDate);
        const durationMonths = parseInt(s.duration) || 0;
        let progressHTML = "";
        if (durationMonths > 0) {
            const endDate = new Date(joinDate);
            endDate.setMonth(endDate.getMonth() + durationMonths);
            const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
            const warnColor = daysLeft < 7 ? "#ef4444" : "#64748b";
            progressHTML = `<br><small style="color:${warnColor}">Ends in: ${daysLeft > 0 ? daysLeft + ' days' : 'Expired'}</small>`;
        }

        return `
        <tr>
            <td>#${s.id}</td>
            <td><strong>${s.name}</strong>${progressHTML}</td>
            <td>${s.course}</td>
            <td><span style="color: ${color}; font-weight:bold;">${currentStatus}</span></td>
            <td>
                <button class="btn-present" style="background:#dcfce7; color:#166534; padding:5px 10px;" onclick="setAtt('${selectedDate}', '${s.id}', 'Present')">P</button>
                <button class="btn-absent" style="background:#fee2e2; color:#991b1b; padding:5px 10px;" onclick="setAtt('${selectedDate}', '${s.id}', 'Absent')">A</button>
            </td>
        </tr>`;
    }).join('');
}

function setAtt(date, id, status) {
    if (!attendanceRegistry[date]) attendanceRegistry[date] = {};
    attendanceRegistry[date][id] = status;
    saveData();
    renderAttendance();
}

function markAsHoliday() {
    const date = document.getElementById('attendanceDate').value;
    if (confirm(`Mark all as Holiday for ${date}?`)) {
        if (!attendanceRegistry[date]) attendanceRegistry[date] = {};
        students.forEach(s => attendanceRegistry[date][s.id] = "Holiday");
        saveData(); renderAttendance();
    }
}

// --- FINANCE SYSTEM ---
function generateInvoice() {
    const id = document.getElementById('feeStudentId').value;
    const amt = document.getElementById('feeAmount').value;
    if(!id || !amt) return alert("Missing Info");
    
    transactions.unshift({
        studentId: id,
        name: students.find(s => s.id === id).name,
        amount: amt,
        date: new Date().toLocaleDateString('en-IN')
    });
    saveData(); initSystem();
    document.getElementById('feeAmount').value = "";
}

function addExpense() {
    const cat = document.getElementById('expCategory').value;
    const amt = document.getElementById('expAmount').value;
    if(!amt) return;

    expenses.unshift({ category: cat, amount: amt, date: new Date().toLocaleDateString('en-IN') });
    saveData(); initSystem();
    document.getElementById('expAmount').value = "";
}

function updateFinancialSummary() {
    const rev = transactions.reduce((s, t) => s + Number(t.amount), 0);
    const exp = expenses.reduce((s, e) => s + Number(e.amount), 0);
    document.getElementById('totalRevenue').innerText = `₹${rev}`;
    document.getElementById('totalExpenses').innerText = `₹${exp}`;
    document.getElementById('netProfit').innerText = `₹${rev - exp}`;
}

function renderTransactions() {
    const list = document.getElementById('transactionList');
    if (!list) return;

    // Create labeled logs so we know where they came from
    const incomeLogs = transactions.map((t, idx) => ({ ...t, type: 'Income', originalIndex: idx }));
    const expenseLogs = expenses.map((e, idx) => ({ ...e, type: 'Expense', name: e.category, originalIndex: idx }));

    const allLogs = [...incomeLogs, ...expenseLogs];

    list.innerHTML = allLogs.map(item => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee;">
            <span>
                <strong style="color: ${item.type === 'Income' ? '#22c55e' : '#ef4444'}">${item.type}</strong>: ${item.name}
                <br><small style="color:#64748b;">${item.date}</small>
            </span>
            <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
                <b style="color: ${item.type === 'Income' ? '#22c55e' : '#ef4444'}; margin-right: 10px;">
                    ${item.type === 'Income' ? '+' : '-'}₹${item.amount}
                </b>
                <button onclick="editTransaction(${item.originalIndex}, '${item.type}')" 
                    style="background: #dbeafe; color: #2563eb; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;">
                    Edit
                </button>
                <button onclick="deleteTransaction(${item.originalIndex}, '${item.type}')" 
                    style="background: #fee2e2; color: #ef4444; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;">
                    Delete
                </button>
            </div>
        </li>
    `).join('');
}

function showMonthlyRevenue() {
    const map = {};
    transactions.forEach(t => {
        const m = t.date.split('/')[1] + '/' + t.date.split('/')[2];
        map[m] = (map[m] || 0) + Number(t.amount);
    });
    document.getElementById('monthlyReportContainer').innerHTML = Object.entries(map).map(([m, v]) => `<p>${m}: <b>₹${v}</b></p>`).join('');
}

// --- ID CARD PRINTING ---

    // --- UPDATED ID CARD PRINTING ---
// --- UPDATED ID CARD PRINTING WITH QR CODE ---
function printIdCard(id) {
    const s = students.find(stu => stu.id === id);
    if (!s) return;

    // Replace 'YOUR_GITHUB_URL' with your actual GitHub Pages link
    // Example: https://armaninstitute.github.io/manager/
    const baseUrl = window.location.href.split('?')[0]; 
    const qrData = `${baseUrl}?verify=${s.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
    // Open a clean print window
    const printWin = window.open('', '_blank');
    
    // Construct the professional HTML structure
    const cardHtml = `
        <div>
            <div class="id-header-banner">
                <h2>Arman Institute</h2>
                <p class="id-sub-text">VOCATIONAL & LANGUAGE TRAINING CENTRE</p>
            </div>
            
            <div class="id-body">
                <div id="printPhotoContainer">
                    ${s.photo ? `<img src="${s.photo}">` : '<span style="font-size:40px;">👤</span>'}
                </div>
                
                <div class="id-info">
                    <div class="info-row">
                        <span class="info-label">Student Name</span>
                        <span class="info-value">${s.name.toUpperCase()}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Course Enrolled</span>
                        <span class="info-value">${s.course}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Date of Joining</span>
                        <span class="info-value">${s.joiningDate}</span>
                    </div>
                </div>
            </div>

            <div class="id-qr-box">
                <img src="${qrUrl}" alt="QR Code">
                <span>SCAN TO VERIFY</span>
            </div>
            
            <div class="id-footer-tag">ID: ${s.id}</div>
        </div>
    `;

    printWin.document.write(`
        <html>
        <head>
            <title>ID Card - ${s.name}</title>
            <link rel="stylesheet" href="style.css">
            <style>
                body { background: white; display: flex; justify-content: center; padding-top: 50px; }
            </style>
        </head>
        <body onload="setTimeout(function(){ window.print(); window.close(); }, 500)">
            <div id="printIdCardArea" style="display:block !important;">
                ${cardHtml}
            </div>
        </body>
        </html>
    `);
    
    printWin.document.close();
}
// --- PROFILE & CALENDAR ---
function viewProfile(id) {
    currentViewStudentId = id;
    const s = students.find(st => st.id === id);
    
    // Set Photo (Use default if none exists)
    const photoImg = document.getElementById('profPhotoImg');
    photoImg.src = s.photo || "https://via.placeholder.com/80?text=Student";

    document.getElementById('profName').innerText = s.name;
    document.getElementById('profID').innerText = `#${s.id}`;
    document.getElementById('profCourse').innerText = s.course;
    document.getElementById('profMobile').innerText = s.mobile;
    document.getElementById('profJoin').innerText = s.joiningDate;
    
    const paid = transactions.filter(t => t.studentId === id).reduce((sum, t) => sum + Number(t.amount), 0);
    document.getElementById('profFees').innerText = `₹${paid}`;
    
    renderCalendar();
    openModal('profileModal');
}

function renderCalendar() {
    const grid = document.getElementById('attendanceCalendar');
    grid.innerHTML = "";
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    document.getElementById('currentCalMonth').innerText = new Intl.DateTimeFormat('en-US', {month:'long', year:'numeric'}).format(currentCalDate);

    const days = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= days; i++) {
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const status = (attendanceRegistry[dStr] || {})[currentViewStudentId] || "";
        let color = "#f1f5f9";
        if(status === "Present") color = "#dcfce7";
        if(status === "Absent") color = "#fee2e2";
        if(status === "Holiday") color = "#dbeafe";
        grid.innerHTML += `<div style="background:${color}; padding:5px; text-align:center; border-radius:4px; font-size:11px;">${i}</div>`;
    }
}

function changeMonth(dir) {
    currentCalDate.setMonth(currentCalDate.getMonth() + dir);
    renderCalendar();
}

// --- MODALS & UTILS ---
function handleStudentSubmit() {
    const id = document.getElementById('editStudentId').value;
    const data = {
        name: document.getElementById('newStuName').value,
        course: document.getElementById('newStuCourse').value,
        duration: document.getElementById('newStuDuration').value,
        mobile: document.getElementById('newStuMobile').value,
        joiningDate: document.getElementById('newStuJoinDate').value,
        status: document.getElementById('newStuStatus').value,
        photo: currentBase64Image // SAVE THE PHOTO HERE
    }; 
    if(id) {
        const idx = students.findIndex(s => s.id === id);
        students[idx] = {...students[idx], ...data};
    } else {
        students.push({ id: Date.now().toString().slice(-4), ...data });
    }
    saveData(); 
    initSystem(); 
    closeModal('studentModal');
    currentBase64Image = ""; // Reset for next time
    document.getElementById('modalPhotoPreview').style.display = "none";
}

function openAddModal() {
    document.getElementById('editStudentId').value = "";
    document.getElementById('newStuPhoto').value = "";
    document.getElementById('modalPhotoPreview').style.display = "none";
    currentBase64Image = ""; 
    // ... rest of your existing openAddModal logic ...

    document.getElementById('newStuJoinDate').value = new Date().toISOString().split('T')[0];
    openModal('studentModal');
}

function openUpdateModal(id) {
    const s = students.find(st => st.id === id);
    document.getElementById('editStudentId').value = s.id;
    document.getElementById('newStuName').value = s.name;
    document.getElementById('newStuCourse').value = s.course;
    document.getElementById('newStuDuration').value = s.duration || "";
    document.getElementById('newStuJoinDate').value = s.joiningDate;
    document.getElementById('newStuStatus').value = s.status;
    openModal('studentModal');
}

function updateAcademicStats() {
    document.getElementById('totalStudentCount').innerText = students.length;
    document.getElementById('activeStudentCount').innerText = students.filter(s => s.status === 'Active').length;
}

function updateCourseDropdown() {
    const courses = [...new Set(students.map(s => s.course))];
    document.getElementById('courseFilter').innerHTML = '<option value="All">All Courses</option>' + 
        courses.map(c => `<option value="${c}">${c}</option>`).join('');
}

function refreshStudentDropdown() {
    document.getElementById('feeStudentId').innerHTML = '<option value="">-- Choose Student --</option>' + 
        students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function exportBackup() {
    const blob = new Blob([JSON.stringify({ students, transactions, expenses, attendanceRegistry })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `Arman_Institute_Backup.json`; a.click();
}

function importBackup(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = JSON.parse(ev.target.result);
        students = data.students; transactions = data.transactions; 
        expenses = data.expenses || []; attendanceRegistry = data.attendanceRegistry;
        saveData(); location.reload();
    };
    reader.readAsText(e.target.files[0]);
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function resetSystem() { if(confirm("Clear All?")) { localStorage.clear(); location.reload(); } }
// --- DELETE TRANSACTION ---
function deleteTransaction(index, type) {
    if (confirm(`Delete this ${type} record permanently?`)) {
        if (type === 'Income') {
            transactions.splice(index, 1);
        } else {
            expenses.splice(index, 1);
        }
        saveData();
        updateFinancialSummary();
        renderTransactions();
    }
}

// --- EDIT TRANSACTION ---
function editTransaction(index, type) {
    if (type === 'Income') {
        const t = transactions[index];
        // 1. Switch to Fee Collection Section
        showSection('fee-collection', document.querySelector('[onclick*="fee-collection"]'));
        // 2. Fill the form
        document.getElementById('feeStudentId').value = t.studentId;
        document.getElementById('feeAmount').value = t.amount;
        // 3. Remove the old record so the "Save" acts as an update
        transactions.splice(index, 1);
        alert("Transaction loaded into 'Fee Collection'. Edit the amount and click 'Generate & Save' to update.");
    } else {
        const e = expenses[index];
        // 1. Switch to Expenses Section
        showSection('expenses', document.querySelector('[onclick*="expenses"]'));
        // 2. Fill the form
        document.getElementById('expCategory').value = e.category;
        document.getElementById('expAmount').value = e.amount;
        // 3. Remove old record
        expenses.splice(index, 1);
        alert("Expense loaded into 'Record Expense'. Edit and click 'Save' to update.");
    }
    saveData();
    updateFinancialSummary();
    renderTransactions();
}
let currentBase64Image = "";

function previewImage(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        currentBase64Image = e.target.result;
        const preview = document.getElementById('modalPhotoPreview');
        preview.src = currentBase64Image;
        preview.style.display = "block";
    };
    if (file) reader.readAsDataURL(file);
}
function verifyStudent() {
    const id = document.getElementById('verifyInput').value.trim();
    const s = students.find(stu => stu.id === id);
    const resultDiv = document.getElementById('verifyResult');

    if (!s) {
        alert("Student ID not found!");
        resultDiv.style.display = "none";
        return;
    }

    // 1. Calculate Attendance Percentage
    let totalDays = 0;
    let presentDays = 0;
    Object.values(attendanceRegistry).forEach(day => {
        if (day[id]) {
            totalDays++;
            if (day[id] === "Present") presentDays++;
        }
    });
    const attPercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // 2. Calculate Total Fees Paid
    const studentPayments = transactions.filter(t => t.studentId === id);
    const totalPaid = studentPayments.reduce((sum, t) => sum + Number(t.amount), 0);

    // 3. Get Last 5 Transactions
    const lastFive = studentPayments.slice(0, 5);
    const transactionHTML = lastFive.length > 0 
        ? lastFive.map(t => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:0.85rem;">
                <span style="color:var(--text-muted);">${t.date}</span>
                <span style="font-weight:600; color:var(--success);">+₹${t.amount}</span>
            </div>
        `).join('')
        : `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center;">No payment records found.</p>`;

    // 4. Update the UI
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `
        <div class="card" style="border-left: 5px solid var(--primary);">
            <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px;">
                <img src="${s.photo || 'https://via.placeholder.com/80'}" style="width:100px; height:100px; border-radius:12px; object-fit:cover; border:2px solid #eee;">
                <div>
                    <h2 style="margin:0;">${s.name.toUpperCase()}</h2>
                    <p style="color:var(--text-muted); margin:5px 0;">Course: <b>${s.course}</b> | Status: <b>${s.status || 'Active'}</b></p>
                </div>
            </div>
            
            <div class="stats-row-grid">
                <div class="stat-box" style="border-bottom-color: var(--success);">
                    <p style="color:var(--text-muted); font-size:10px; margin:0; font-weight:bold;">ATTENDANCE</p>
                    <h2 style="margin:5px 0;">${attPercentage}%</h2>
                    <small>${presentDays} days present</small>
                </div>
                <div class="stat-box" style="border-bottom-color: var(--primary);">
                    <p style="color:var(--text-muted); font-size:10px; margin:0; font-weight:bold;">TOTAL PAID</p>
                    <h2 style="margin:5px 0;">₹${totalPaid}</h2>
                    <small>Full History</small>
                </div>
            </div>

            <div style="margin-top:25px; background:#f8fafc; padding:15px; border-radius:12px;">
                <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:var(--text-main); border-bottom:2px solid #e2e8f0; padding-bottom:5px;">
                    Last 5 Fee Installments
                </h4>
                ${transactionHTML}
            </div>
        </div>
    `;
}
const ADMIN_PASSWORD = "Guru@1915"; // 👈 Set your private password here

function checkAdminLogin() {
    const input = document.getElementById('adminPassInput').value;
    const errorMsg = document.getElementById('loginError');
    const loginModal = document.getElementById('loginModal');

    if (input === ADMIN_PASSWORD) {
        loginModal.style.display = 'none';
        sessionStorage.setItem('isAdmin', 'true'); // Keeps you logged in for this session
    } else {
        errorMsg.style.display = 'block';
    }
}

// Update your window.onload to allow QR scans WITHOUT logging in
const originalOnload = window.onload;
window.onload = () => {
    if (originalOnload) originalOnload();

    // Check if we are already logged in
    if (sessionStorage.getItem('isAdmin') === 'true') {
        document.getElementById('loginModal').style.display = 'none';
    }

    // IMPORTANT: If a QR code is scanned, hide the login modal 
    // but ONLY show the verify section (Dashboard remains locked)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verify')) {
        document.getElementById('loginModal').style.display = 'none';
        // Hide the sidebar so they can't click other sections
        document.querySelector('.sidebar').style.display = 'none';
        // Ensure only verify section shows
        showSection('verify-student', null); 
    }
};

