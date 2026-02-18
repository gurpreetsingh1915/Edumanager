// --- DATA INITIALIZATION ---
const STU_KEY = 'stuData';
const TRANS_KEY = 'transData';
const ATT_KEY = 'attendanceRegistry';

let students = JSON.parse(localStorage.getItem(STU_KEY)) || [];
let transactions = JSON.parse(localStorage.getItem(TRANS_KEY)) || [];
let attendanceRegistry = JSON.parse(localStorage.getItem(ATT_KEY)) || {};

// Global state for Profile View
let currentViewStudentId = null;
let currentCalDate = new Date();

window.onload = () => {
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    refreshStudentDropdown(); 
    renderAttendance(); 
    renderTransactions();
    updateFinancialSummary();
};

function saveData() {
    localStorage.setItem(STU_KEY, JSON.stringify(students));
    localStorage.setItem(TRANS_KEY, JSON.stringify(transactions));
    localStorage.setItem(ATT_KEY, JSON.stringify(attendanceRegistry));
}

// --- BACKUP & IMPORT ---
function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            const backupStudents = importedData.students || importedData.stuData;
            if (backupStudents && Array.isArray(backupStudents)) {
                if (confirm(`Found ${backupStudents.length} students. Overwrite current data?`)) {
                    students = backupStudents;
                    transactions = importedData.transactions || [];
                    attendanceRegistry = importedData.attendanceRegistry || {};
                    saveData();
                    alert("Import Successful!");
                    location.reload(); 
                }
            }
        } catch (err) { alert("Error: " + err.message); }
    };
    reader.readAsText(file);
}

function exportBackup() {
    const data = { students, transactions, attendanceRegistry };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EduManager_Backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    a.click();
}

// --- ACADEMIC & ATTENDANCE ---
function filterStudents() {
    const query = document.getElementById('studentSearch').value.toLowerCase();
    const filtered = students.filter(s => 
        s.name.toLowerCase().includes(query) || 
        s.course.toLowerCase().includes(query) ||
        (s.status && s.status.toLowerCase().includes(query)) ||
        s.id.includes(query)
    );
    renderAttendance(filtered);
}

function renderAttendance(dataToRender = students) {
    const selectedDate = document.getElementById('attendanceDate').value;
    const list = document.getElementById('attendanceList');
    if (!list) return;
    const dayRecord = attendanceRegistry[selectedDate] || {};

    list.innerHTML = dataToRender.map(s => {
        const currentStatus = dayRecord[s.id] || "Absent";
        let color = "#ef4444"; 
        if(currentStatus === "Present") color = "#22c55e";
        if(currentStatus === "Holiday") color = "#3b82f6";

        const statusClass = `status-${(s.status || 'Active').toLowerCase()}`;

        return `
        <tr>
            <td>#${s.id}</td>
            <td>
                <strong style="cursor:pointer; color:#2563eb;" onclick="viewProfile('${s.id}')">${s.name}</strong><br>
                <small>Joined: ${s.joiningDate || 'N/A'}</small>
            </td>
            <td>${s.course}</td>
            <td><span class="${statusClass}">${s.status || 'Active'}</span></td>
            <td><span style="color: ${color}; font-weight:bold;">${currentStatus}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-present" onclick="toggleAttendance('${selectedDate}', '${s.id}', 'Present')">P</button>
                    <button class="btn-absent" style="margin-left:5px" onclick="toggleAttendance('${selectedDate}', '${s.id}', 'Absent')">A</button>
                    <button class="btn-edit" style="margin-left:10px" onclick="openUpdateModal('${s.id}')">Edit</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function toggleAttendance(date, stuId, status) {
    if (!attendanceRegistry[date]) attendanceRegistry[date] = {};
    attendanceRegistry[date][stuId] = status;
    saveData();
    renderAttendance();
}

function markAsHoliday() {
    const selectedDate = document.getElementById('attendanceDate').value;
    if (!selectedDate) return alert("Please select a date first");

    if (confirm(`Mark ${selectedDate} as a Institute Holiday?`)) {
        if (!attendanceRegistry[selectedDate]) attendanceRegistry[selectedDate] = {};
        students.forEach(s => {
            attendanceRegistry[selectedDate][s.id] = "Holiday";
        });
        saveData();
        renderAttendance();
        alert("Holiday marked successfully!");
    }
}

// --- FINANCIALS ---
function refreshStudentDropdown() {
    const drop = document.getElementById('feeStudentId');
    if (drop) drop.innerHTML = '<option value="">-- Choose Student --</option>' + 
        students.map(s => `<option value="${s.id}">${s.name} (#${s.id})</option>`).join('');
}

function renderTransactions() {
    const list = document.getElementById('transactionList');
    if (!list) return;
    list.innerHTML = transactions.map((t, index) => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
            <span><strong>${t.name}</strong><br><small>${t.date}</small></span>
            <div style="text-align:right">
                <span style="color:#22c55e; font-weight:bold; display:block;">+₹${Number(t.amount).toLocaleString('en-IN')}</span>
                <button onclick="deleteTransaction(${index})" style="color:#ef4444; border:none; background:none; cursor:pointer; font-size:0.75rem;">Delete</button>
            </div>
        </li>
    `).join('');
}

function deleteTransaction(index) {
    if(confirm("Delete this record?")) {
        transactions.splice(index, 1);
        saveData();
        renderTransactions();
        updateFinancialSummary();
    }
}

function generateInvoice() {
    const studentId = document.getElementById('feeStudentId').value;
    const amount = parseFloat(document.getElementById('feeAmount').value);
    if (!studentId || isNaN(amount)) return alert("Select student and amount");
    const student = students.find(s => s.id === studentId);

    transactions.unshift({
        studentId: student.id,
        name: student.name,
        amount: amount,
        date: new Date().toLocaleDateString('en-IN')
    });

    saveData();
    renderTransactions();
    updateFinancialSummary();
    document.getElementById('feeAmount').value = "";
}

function updateFinancialSummary() {
    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const revenueEl = document.getElementById('totalRevenue');
    const countEl = document.getElementById('totalTransCount');
    if (revenueEl) revenueEl.innerText = `₹${total.toLocaleString('en-IN')}`;
    if (countEl) countEl.innerText = transactions.length;
}

// --- PROFILE & CALENDAR ---
function viewProfile(id) {
    const s = students.find(st => st.id === id);
    if (!s) return;
    currentViewStudentId = id;
    currentCalDate = new Date(); 

    document.getElementById('profName').innerText = s.name;
    document.getElementById('profID').innerText = `#${s.id}`;
    document.getElementById('profCourse').innerText = s.course;
    document.getElementById('profJoin').innerText = s.joiningDate || 'N/A';
    document.getElementById('profMobile').innerText = s.mobile || '---';
    
    renderProfileData();
    openModal('profileModal');
}

function renderProfileData() {
    const id = currentViewStudentId;
    let presentCount = 0;
    let totalAttendanceDays = 0;

    // Calculate Stats across the whole registry
    Object.values(attendanceRegistry).forEach(day => {
        if (day[id]) {
            if (day[id] !== "Holiday") {
                totalAttendanceDays++;
                if (day[id] === "Present") presentCount++;
            }
        }
    });

    const percentage = totalAttendanceDays > 0 ? ((presentCount / totalAttendanceDays) * 100).toFixed(1) : "0";
    document.getElementById('profAttendance').innerText = `${percentage}%`;

    const totalPaid = transactions.filter(t => t.studentId === id).reduce((sum, t) => sum + Number(t.amount), 0);
    document.getElementById('profFees').innerText = `₹${totalPaid.toLocaleString('en-IN')}`;

    renderCalendar(id);

    document.getElementById('profTransList').innerHTML = transactions
        .filter(t => t.studentId === id)
        .map(t => `<li style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${t.date}: <strong>₹${t.amount.toLocaleString('en-IN')}</strong></li>`).join('') || '<li>No payments</li>';
}

function renderCalendar(stuId) {
    const grid = document.getElementById('attendanceCalendar');
    const monthDisp = document.getElementById('currentCalMonth');
    if (!grid || !monthDisp) return;

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    
    // Display Month Name and Year
    monthDisp.innerText = currentCalDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    grid.innerHTML = '';
    
    // Add empty placeholders for days of the week before the 1st
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="cal-day empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        // Formulate key to match YYYY-MM-DD format of <input type="date">
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const status = attendanceRegistry[dateStr] ? attendanceRegistry[dateStr][stuId] : null;
        
        let statusClass = '';
        if (status === 'Present') statusClass = 'cal-present';
        else if (status === 'Absent') statusClass = 'cal-absent';
        else if (status === 'Holiday') statusClass = 'cal-holiday';

        grid.innerHTML += `<div class="cal-day ${statusClass}">${day}</div>`;
    }
}

function changeMonth(dir) {
    currentCalDate.setMonth(currentCalDate.getMonth() + dir);
    renderCalendar(currentViewStudentId);
}

// --- MODALS & FORM HANDLING ---
function handleStudentSubmit() {
    const id = document.getElementById('editStudentId').value;
    const name = document.getElementById('newStuName').value;
    const course = document.getElementById('newStuCourse').value;
    const mobile = document.getElementById('newStuMobile').value;
    const date = document.getElementById('newStuJoinDate').value;
    const status = document.getElementById('newStuStatus').value;

    if (!name || !course) return alert("Fill Name and Course");

    if (id) {
        const idx = students.findIndex(s => s.id === id);
        students[idx] = { ...students[idx], name, course, mobile, joiningDate: date, status };
    } else {
        students.push({ 
            id: Date.now().toString().slice(-4), 
            name, course, mobile, 
            joiningDate: date, 
            status: "Active" 
        });
    }
    saveData();
    refreshStudentDropdown();
    renderAttendance();
    closeModal('studentModal');
}

function openAddModal() {
    document.getElementById('modalTitle').innerText = "Add Student";
    document.getElementById('editStudentId').value = "";
    document.getElementById('newStuName').value = "";
    document.getElementById('newStuCourse').value = "";
    document.getElementById('newStuMobile').value = "";
    document.getElementById('newStuJoinDate').value = new Date().toISOString().split('T')[0];
    openModal('studentModal');
}

function openUpdateModal(id) {
    const s = students.find(st => st.id === id);
    document.getElementById('modalTitle').innerText = "Update Student";
    document.getElementById('editStudentId').value = s.id;
    document.getElementById('newStuName').value = s.name;
    document.getElementById('newStuCourse').value = s.course;
    document.getElementById('newStuMobile').value = s.mobile || "";
    document.getElementById('newStuJoinDate').value = s.joiningDate;
    document.getElementById('newStuStatus').value = s.status;
    openModal('studentModal');
}

function showSection(id, btn) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function resetSystem() { if(confirm("PERMANENTLY delete all data?")) { localStorage.clear(); location.reload(); } }

// --- REPORT PRINTING ---
// --- UPDATED REPORT PRINTING WITH CALENDAR ---
function downloadStudentReport() {
    const name = document.getElementById('profName').innerText;
    const id = document.getElementById('profID').innerText;
    const course = document.getElementById('profCourse').innerText;
    const attendance = document.getElementById('profAttendance').innerText;
    const totalPaid = document.getElementById('profFees').innerText;
    
    const calendarHTML = document.getElementById('attendanceCalendar').innerHTML;
    const currentMonth = document.getElementById('currentCalMonth').innerText;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Report - ${name}</title>
            <style>
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: auto; }
                
                /* --- Institute Branding --- */
                .branding-header { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 10px; }
                .institute-logo { width: 80px; height: 80px; object-fit: contain; }
                .institute-name { margin: 0; color: #0f172a; font-size: 2.2rem; font-weight: 800; letter-spacing: -1px; }
                .report-title { text-align: center; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 0.9rem; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 15px; }
                
                .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .student-info p { margin: 5px 0; font-size: 1.05rem; }
                
                .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                .stat-card { background: #f1f5f9; padding: 20px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0; }
                .stat-card label { font-size: 0.75rem; color: #64748b; font-weight: bold; text-transform: uppercase; }
                .stat-card h2 { margin: 8px 0 0 0; color: #2563eb; font-size: 1.8rem; }

                /* Calendar Styles */
                .calendar-container { margin-top: 20px; }
                .calendar-title { font-size: 1.1rem; font-weight: bold; margin-bottom: 10px; color: #1e293b; }
                .calendar-grid { 
                    display: grid; 
                    grid-template-columns: repeat(7, 1fr); 
                    gap: 8px; 
                    background: #f8fafc; 
                    padding: 15px; 
                    border-radius: 12px; 
                    border: 1px solid #e2e8f0;
                }
                .cal-day { background: white; height: 45px; display: flex; align-items: center; justify-content: center; font-weight: bold; border-radius: 6px; border: 1px solid #f1f5f9; font-size: 0.9rem; }
                .empty { background: transparent; border: none; }
                
                /* Attendance Colors */
                .cal-present { background-color: #22c55e !important; color: white !important; }
                .cal-absent { background-color: #ef4444 !important; color: white !important; }
                .cal-holiday { background-color: #3b82f6 !important; color: white !important; }

                /* Legend */
                .legend { display: flex; gap: 20px; margin-top: 15px; font-size: 0.85rem; justify-content: center; font-weight: 600; }
                .legend-item { display: flex; align-items: center; gap: 8px; }
                .dot { width: 14px; height: 14px; border-radius: 4px; }

                .footer { margin-top: 50px; text-align: center; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            </style>
        </head>
        <body>
            <div class="branding-header">
                <img src="logo.jpg" alt="Institute Logo" class="institute-logo">
                <h1 class="institute-name">ARMAN INSTITUTE</h1>
            </div>
            <div class="report-title">Student Performance Report</div>

            <div class="info-section">
                <div class="student-info">
                    <p><strong>Student:</strong> ${name}</p>
                    <p><strong>ID:</strong> ${id}</p>
                    <p><strong>Course:</strong> ${course}</p>
                </div>
                <div style="text-align: right; color: #64748b; font-size: 0.9rem;">
                    <p>Generated: ${new Date().toLocaleDateString('en-IN')}</p>
                </div>
            </div>

            <div class="stat-grid">
                <div class="stat-card">
                    <label>Attendance Rate</label>
                    <h2>${attendance}</h2>
                </div>
                <div class="stat-card">
                    <label>Total Fees Paid</label>
                    <h2>${totalPaid}</h2>
                </div>
            </div>

            <div class="calendar-container">
                <div class="calendar-title">Attendance History: ${currentMonth}</div>
                <div class="calendar-grid">
                    ${calendarHTML}
                </div>
                <div class="legend">
                    <div class="legend-item"><div class="dot" style="background:#22c55e"></div> Present</div>
                    <div class="legend-item"><div class="dot" style="background:#ef4444"></div> Absent</div>
                    <div class="legend-item"><div class="dot" style="background:#3b82f6"></div> Holiday</div>
                </div>
            </div>

            <div class="footer">
                © ${new Date().getFullYear()} Arman Institute. This document is a computer-generated record.
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 700);
}
