// --- 1. CONFIGURATION & GLOBALS ---
const firebaseConfig = {
    apiKey: "AIzaSyDXv14dGQgPln72g_kMFHMOAoEYnxkTrOM",
    authDomain: "armaninstitute-d3e37.firebaseapp.com",
   databaseURL: "https://armaninstitute-d3e37-default-rtdb.firebaseio.com", 
    projectId: "armaninstitute-d3e37",
    storageBucket: "armaninstitute-d3e37.firebasestorage.app",
    messagingSenderId: "921004735664",
    appId: "1:921004735664:web:9f01e218853596cc0ccf75",
    measurementId: "G-B7RV2E5PDG"
};

// Admin Password
const ADMIN_PASSWORD = "Guru@1915"; // Change this to your preferred password

// Global State
let students = [];
let transactions = [];
let expenses = [];
let attendanceRegistry = {};
let currentViewStudentId = null;
let currentCalDate = new Date();
let currentBase64Image = "";

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// --- 2. AUTHENTICATION & SYNC ---
const initializeAuth = () => {
    if (typeof firebase.auth !== 'function') {
        setTimeout(initializeAuth, 100);
        return;
    }

    firebase.auth().signInAnonymously()
        .then(() => {
            console.log("Secure Connection Established to Arman Institute Database");
            startDataSync();
        })
        .catch((error) => {
            console.error("Connection Error: ", error.message);
        });
};

function startDataSync() {
    db.ref('/').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            students = data.students || [];
            transactions = data.transactions || [];
            expenses = data.expenses || [];
            attendanceRegistry = data.attendanceRegistry || {};
            initSystem(); 
        } else {
            console.warn("Database is currently empty.");
        }
        handleRouteLogic();
    });
}

// --- 3. CORE LOGIC ---
function initSystem() {
    updateAcademicStats();
    updateCourseDropdown();
    refreshStudentDropdown();
    renderEnrolmentTable();
    renderAttendance();
    updateFinancialSummary();
    renderTransactions();
}

function handleRouteLogic() {
    const urlParams = new URLSearchParams(window.location.search);
    const verifyId = urlParams.get('verify');

    if (verifyId) {
        document.getElementById('loginModal').style.display = 'none';
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.display = 'none';
        
        showSection('verify-student', null);
        document.getElementById('verifyInput').value = verifyId;
        verifyStudent();
    } else {
        if (sessionStorage.getItem('isAdmin') === 'true') {
            document.getElementById('loginModal').style.display = 'none';
        } else {
            document.getElementById('loginModal').style.display = 'flex';
        }
    }
}

function saveData() {
    return db.ref('/').set({
        students,
        transactions,
        expenses,
        attendanceRegistry
    }).then(() => {
        console.log("Cloud Backup Successful");
    });
}

// --- 4. NAVIGATION ---
function showSection(id, btn) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const section = document.getElementById(id);
    if (section) section.classList.add('active');
    if (btn) btn.classList.add('active');

    if(id === 'enrolment') renderEnrolmentTable();
    if(id === 'attendance') renderAttendance();
}

// --- 5. STUDENT MANAGEMENT ---
function filterStudents() {
    const searchQuery = document.getElementById('studentSearch').value.toLowerCase();
    const courseQuery = document.getElementById('courseFilter').value;
    const statusQuery = document.getElementById('statusFilter').value;

    const filtered = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery) || s.id.includes(searchQuery);
        const matchesCourse = (courseQuery === "All" || s.course === courseQuery);
        const currentStatus = s.status || "Active";
        const matchesStatus = (statusQuery === "All" || currentStatus === statusQuery);
        return matchesSearch && matchesCourse && matchesStatus;
    });

    renderEnrolmentTable(filtered);
}

function renderEnrolmentTable(dataToRender = students) {
    const list = document.getElementById('enrolmentList');
    if (!list) return;

    list.innerHTML = dataToRender.map(s => {
        let statusColor = "#64748b";
        if (s.status === "Active") statusColor = "#22c55e";
        if (s.status === "Completed") statusColor = "#3b82f6";
        if (s.status === "Dropped") statusColor = "#ef4444";

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
            <td><button class="btn-primary" style="background:#059669; padding:5px 8px; font-size:11px;" onclick="printIdCard('${s.id}')">Print ID</button></td>
            <td><button class="btn-edit" onclick="openUpdateModal('${s.id}')">Edit</button></td>
        </tr>`;
    }).join('');
}

// --- 6. ATTENDANCE ---
function renderAttendance(dataToRender = students) {
    const dateInput = document.getElementById('attendanceDate');
    if (!dateInput) return;
    const selectedDate = dateInput.value;
    const list = document.getElementById('attendanceList');
    if (!list) return;
    const dayRecord = attendanceRegistry[selectedDate] || {};

    list.innerHTML = dataToRender.map(s => {
        const currentStatus = dayRecord[s.id] || "Absent";
        const color = currentStatus === "Present" ? "#22c55e" : (currentStatus === "Holiday" ? "#3b82f6" : "#ef4444");

        return `
        <tr>
            <td>#${s.id}</td>
            <td><strong>${s.name}</strong></td>
            <td>${s.course}</td>
            <td><span style="color: ${color}; font-weight:bold;">${currentStatus}</span></td>
            <td>
                <button class="btn-present" style="background:#dcfce7; color:#166534; padding:5px 10px; border:none; cursor:pointer;" onclick="setAtt('${selectedDate}', '${s.id}', 'Present')">P</button>
                <button class="btn-absent" style="background:#fee2e2; color:#991b1b; padding:5px 10px; border:none; cursor:pointer;" onclick="setAtt('${selectedDate}', '${s.id}', 'Absent')">A</button>
            </td>
        </tr>`;
    }).join('');
}

function setAtt(date, id, status) {
    if (!attendanceRegistry[date]) attendanceRegistry[date] = {};
    attendanceRegistry[date][id] = status;
    saveData().then(() => renderAttendance());
}

function markAsHoliday() {
    const date = document.getElementById('attendanceDate').value;
    if (confirm(`Mark all as Holiday for ${date}?`)) {
        if (!attendanceRegistry[date]) attendanceRegistry[date] = {};
        students.forEach(s => attendanceRegistry[date][s.id] = "Holiday");
        saveData().then(() => renderAttendance());
    }
}

// --- 7. FINANCE & EXPENSES ---
function generateInvoice() {
    const id = document.getElementById('feeStudentId').value;
    const amt = document.getElementById('feeAmount').value;
    if(!id || !amt) return alert("Please select a student and enter an amount.");
    
    const student = students.find(s => s.id === id);
    transactions.unshift({
        studentId: id,
        name: student ? student.name : "Unknown",
        amount: amt,
        date: new Date().toLocaleDateString('en-IN')
    });
    saveData().then(() => {
        document.getElementById('feeAmount').value = "";
        initSystem();
    });
}

function addExpense() {
    const cat = document.getElementById('expCategory').value;
    const amt = document.getElementById('expAmount').value;
    if(!amt) return;

    expenses.unshift({ category: cat, amount: amt, date: new Date().toLocaleDateString('en-IN') });
    saveData().then(() => {
        document.getElementById('expAmount').value = "";
        initSystem();
    });
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
                <button onclick="editTransaction(${item.originalIndex}, '${item.type}')" class="btn-edit" style="font-size:11px; padding:5px;">Edit</button>
                <button onclick="deleteTransaction(${item.originalIndex}, '${item.type}')" class="btn-reset" style="font-size:11px; padding:5px; background:#fee2e2; color:#ef4444; border:none;">Del</button>
            </div>
        </li>`).join('');
}

function showMonthlyRevenue() {
    const map = {};
    transactions.forEach(t => {
        const parts = t.date.split('/');
        const m = parts[1] + '/' + parts[2];
        map[m] = (map[m] || 0) + Number(t.amount);
    });
    const container = document.getElementById('monthlyReportContainer');
    container.style.display = 'block';
    container.innerHTML = '<h4>Monthly Analysis</h4>' + Object.entries(map).map(([m, v]) => `<p>${m}: <b>₹${v}</b></p>`).join('');
}

// --- 8. ID CARD & QR ---
function printIdCard(id) {
    const s = students.find(stu => stu.id === id);
    if (!s) return;

    const baseUrl = window.location.href.split('?')[0]; 
    const qrData = `${baseUrl}?verify=${s.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
    
    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <html>
        <head>
            <title>ID Card - ${s.name}</title>
            <style>
                .card { width: 350px; border: 2px solid #2563eb; border-radius: 15px; padding: 20px; font-family: sans-serif; text-align: center; }
                .photo { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; }
                .qr { width: 100px; margin-top: 10px; }
                h2 { color: #2563eb; margin: 5px 0; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="card">
                <h2>Arman Institute</h2>
                ${s.photo ? `<img src="${s.photo}" class="photo">` : '👤'}
                <h3>${s.name.toUpperCase()}</h3>
                <p>Course: ${s.course}<br>ID: #${s.id}</p>
                <img src="${qrUrl}" class="qr"><br>
                <small>SCAN TO VERIFY</small>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
}

// --- 9. MODALS & FORMS ---
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

function handleStudentSubmit() {
    const id = document.getElementById('editStudentId').value;
    const data = {
        name: document.getElementById('newStuName').value,
        course: document.getElementById('newStuCourse').value,
        duration: document.getElementById('newStuDuration').value,
        mobile: document.getElementById('newStuMobile').value,
        joiningDate: document.getElementById('newStuJoinDate').value,
        status: document.getElementById('newStuStatus').value,
        photo: currentBase64Image || (id ? students.find(s => s.id === id).photo : "")
    };

    if(id) {
        const idx = students.findIndex(s => s.id === id);
        students[idx] = { ...students[idx], ...data };
    } else {
        students.push({ id: Date.now().toString().slice(-4), ...data });
    }
    
    saveData().then(() => {
        closeModal('studentModal');
        initSystem();
    });
}

function openAddModal() {
    document.getElementById('editStudentId').value = "";
    document.getElementById('newStuName').value = "";
    document.getElementById('newStuCourse').value = "";
    document.getElementById('newStuDuration').value = "";
    document.getElementById('newStuMobile').value = "";
    document.getElementById('newStuJoinDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalPhotoPreview').style.display = "none";
    currentBase64Image = "";
    openModal('studentModal');
}

function openUpdateModal(id) {
    const s = students.find(st => st.id === id);
    document.getElementById('editStudentId').value = s.id;
    document.getElementById('newStuName').value = s.name;
    document.getElementById('newStuCourse').value = s.course;
    document.getElementById('newStuDuration').value = s.duration || "";
    document.getElementById('newStuMobile').value = s.mobile;
    document.getElementById('newStuJoinDate').value = s.joiningDate;
    document.getElementById('newStuStatus').value = s.status;
    if(s.photo) {
        const preview = document.getElementById('modalPhotoPreview');
        preview.src = s.photo;
        preview.style.display = "block";
        currentBase64Image = s.photo;
    }
    openModal('studentModal');
}

// --- 10. UTILS & SYSTEM ---
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
    const dropdown = document.getElementById('feeStudentId');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">-- Choose Student --</option>' + 
        students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function viewProfile(id) {
    currentViewStudentId = id;
    const s = students.find(st => st.id === id);
    if(!s) return;

    document.getElementById('profPhotoImg').src = s.photo || "https://via.placeholder.com/80?text=Student";
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
    if(!grid) return;
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

function checkAdminLogin() {
    const input = document.getElementById('adminPassInput').value;
    if (input === ADMIN_PASSWORD) {
        document.getElementById('loginModal').style.display = 'none';
        sessionStorage.setItem('isAdmin', 'true');
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
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

    let totalDays = 0, presentDays = 0;
    Object.values(attendanceRegistry).forEach(day => {
        if (day[id]) { totalDays++; if (day[id] === "Present") presentDays++; }
    });
    const attPercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
    const totalPaid = transactions.filter(t => t.studentId === id).reduce((sum, t) => sum + Number(t.amount), 0);

    resultDiv.style.display = "block";
    resultDiv.innerHTML = `
        <div style="padding:20px; text-align:center;">
            <img src="${s.photo || ''}" style="width:100px; height:100px; border-radius:50%; object-fit:cover;">
            <h2>${s.name.toUpperCase()}</h2>
            <p>Course: ${s.course} | Status: ${s.status || 'Active'}</p>
            <hr>
            <p>Attendance: <b>${attPercentage}%</b></p>
            <p>Fees Paid: <b>₹${totalPaid}</b></p>
        </div>`;
}

function deleteTransaction(index, type) {
    if (confirm(`Delete this ${type} record?`)) {
        if (type === 'Income') transactions.splice(index, 1);
        else expenses.splice(index, 1);
        saveData().then(() => initSystem());
    }
}

function editTransaction(index, type) {
    if (type === 'Income') {
        const t = transactions[index];
        showSection('fee-collection', null);
        document.getElementById('feeStudentId').value = t.studentId;
        document.getElementById('feeAmount').value = t.amount;
        transactions.splice(index, 1);
    } else {
        const e = expenses[index];
        showSection('expenses', null);
        document.getElementById('expCategory').value = e.category;
        document.getElementById('expAmount').value = e.amount;
        expenses.splice(index, 1);
    }
    saveData().then(() => initSystem());
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function resetSystem() { if(confirm("Clear All Cloud Data?")) { db.ref('/').set({}).then(() => location.reload()); } }

function exportBackup() {
    const blob = new Blob([JSON.stringify({ students, transactions, expenses, attendanceRegistry })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `Arman_Institute_Backup.json`; a.click();
}

// --- UPDATED IMPORT FUNCTION ---
function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            
            // Assign the recovered data to global variables
            students = data.students || [];
            transactions = data.transactions || [];
            expenses = data.expenses || [];
            attendanceRegistry = data.attendanceRegistry || {};

            console.log("Data recovered locally. Syncing to Firebase...");

            // CRITICAL: We wait for Firebase to confirm the save before reloading
            saveData().then(() => {
                alert("SUCCESS: All data moved to Cloud (Firebase). Your records are now permanent.");
                location.reload(); 
            }).catch(err => {
                console.error("Firebase Sync Failed:", err);
                alert("Error syncing to cloud. Please check your internet and Firebase rules.");
            });
        } catch (err) {
            console.error("Parse Error:", err);
            alert("Invalid backup file format.");
        }
    };
    reader.readAsText(file);
}

// --- IMPROVED DATA SYNC (Add this check) ---
function startDataSync() {
    db.ref('/').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && (data.students || data.transactions)) {
            students = data.students || [];
            transactions = data.transactions || [];
            expenses = data.expenses || [];
            attendanceRegistry = data.attendanceRegistry || {};
            initSystem(); 
        } else {
            // If cloud is empty, we DON'T overwrite if local variables already have data
            console.warn("Cloud is empty. Ready for first import.");
        }
        handleRouteLogic();
    });
}

// --- 11. INITIALIZATION ---
window.onload = () => {
    initializeAuth();
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
};



