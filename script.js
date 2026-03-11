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
};

function initSystem() {
    updateAcademicStats();
    updateCourseDropdown();
    refreshStudentDropdown();
    renderEnrolmentTable(); // Make sure this line exists!
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
    const statusQuery = document.getElementById('statusFilter').value;

    const filtered = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery) || s.id.includes(searchQuery);
        const matchesCourse = (courseQuery === "All" || s.course === courseQuery);
        const matchesStatus = (statusQuery === "All" || (s.status || "Active") === statusQuery);
        return matchesSearch && matchesCourse && matchesStatus;
    });

    renderEnrolmentTable(filtered);
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

    // We map both, ensuring we use 'name' for both so the list can display them
    const incomeLogs = transactions.map((t, idx) => ({ 
        ...t, 
        type: 'Income', 
        displayName: t.name, 
        originalIndex: idx 
    }));
    
    const expenseLogs = expenses.map((e, idx) => ({ 
        ...e, 
        type: 'Expense', 
        displayName: e.category, // Use category as the name for expenses
        originalIndex: idx 
    }));

    const allLogs = [...incomeLogs, ...expenseLogs];

    list.innerHTML = allLogs.map(item => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee;">
            <span>
                <strong style="color: ${item.type === 'Income' ? '#22c55e' : '#ef4444'}">${item.type}</strong>: ${item.displayName}
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
function printIdCard(id) {
    const s = students.find(stu => stu.id === id);
    if (!s) return alert("Student record not found.");

    // 1. Fill Text Data
    document.getElementById('idCardName').innerText = s.name.toUpperCase();
    document.getElementById('idCardID').innerText = `#${s.id}`;
    document.getElementById('idCardCourse').innerText = s.course;
    document.getElementById('idCardJoin').innerText = s.joiningDate;

    // 2. Handle Photo Logic (Targeting the new printPhotoContainer ID)
    const photoBox = document.getElementById('printPhotoContainer');
    if (s.photo) {
        photoBox.innerHTML = `<img src="${s.photo}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
        photoBox.innerHTML = `<span style="font-size: 40px;">👤</span>`;
    }

    // 3. Open Print Window and write full HTML context
    const prt = window.open('', '_blank');
    prt.document.write(`
        <html>
        <head>
            <title>ID Card - ${s.name}</title>
            <style>
                body { 
                    margin: 40px; 
                    display: flex; 
                    justify-content: center; 
                    font-family: sans-serif; 
                }
                @media print {
                    body { margin: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body onload="setTimeout(function(){ window.print(); window.close(); }, 300)">
            ${document.getElementById('printIdCardArea').innerHTML}
        </body>
        </html>
    `);
    
    prt.document.close();
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

