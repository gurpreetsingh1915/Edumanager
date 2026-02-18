// --- DATA INITIALIZATION ---
// Key names used for LocalStorage
const STU_KEY = 'stuData';
const TRANS_KEY = 'transData';
const ATT_KEY = 'attendanceRegistry';

let students = JSON.parse(localStorage.getItem(STU_KEY)) || [];
let transactions = JSON.parse(localStorage.getItem(TRANS_KEY)) || [];
let attendanceRegistry = JSON.parse(localStorage.getItem(ATT_KEY)) || {};

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

// --- SMART IMPORT LOGIC (The Fix) ---
function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // This part looks for any student list, even if the name is slightly different
            const backupStudents = importedData.students || importedData.stuData || importedData.studentData;
            const backupTrans = importedData.transactions || importedData.transData || importedData.paymentData;
            const backupAtt = importedData.attendanceRegistry || importedData.attData;

            if (backupStudents && Array.isArray(backupStudents)) {
                // Confirm with the user
                if (confirm(`Found ${backupStudents.length} students. Overwrite current data?`)) {
                    // Update global variables
                    students = backupStudents;
                    transactions = backupTrans || [];
                    attendanceRegistry = backupAtt || {};

                    // Save to LocalStorage immediately
                    saveData();
                    
                    alert("Import Successful! Reloading your dashboard...");
                    location.reload(); 
                }
            } else {
                alert("This file doesn't seem to contain a valid student list.");
            }
        } catch (err) {
            alert("Error reading file: " + err.message);
        }
    };
    reader.readAsText(file);
}

// --- SEARCH & ACADEMIC ---
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
        const color = currentStatus === "Present" ? "#22c55e" : "#ef4444";
        const statusClass = `status-${(s.status || 'Active').toLowerCase()}`;

        return `
        <tr>
            <td>#${s.id}</td>
            <td>
                <strong class="clickable-name" style="cursor:pointer; color:#2563eb;" onclick="viewProfile('${s.id}')">${s.name}</strong><br>
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

// --- FINANCIAL ---
function refreshStudentDropdown() {
    const dropdown = document.getElementById('feeStudentId');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">-- Choose Student --</option>' + 
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
    if(confirm("Are you sure you want to delete this payment record?")) {
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

function exportBackup() {
    const data = {
        students: students,
        transactions: transactions,
        attendanceRegistry: attendanceRegistry
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EduManager_Backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    a.click();
}

// --- PROFILE & MODALS ---
function viewProfile(id) {
    const s = students.find(st => st.id === id);
    if (!s) return;
    document.getElementById('profName').innerText = s.name;
    document.getElementById('profID').innerText = `#${s.id}`;
    document.getElementById('profCourse').innerText = s.course;
    document.getElementById('profJoin').innerText = s.joiningDate || 'N/A';
    
    const dates = Object.keys(attendanceRegistry).length;
    let present = 0;
    Object.values(attendanceRegistry).forEach(day => { if (day[id] === "Present") present++; });
    document.getElementById('profAttendance').innerText = dates > 0 ? ((present/dates)*100).toFixed(1) + "%" : "0%";

    const personalFees = transactions.filter(t => t.studentId === id);
    const totalPaid = personalFees.reduce((sum, t) => sum + Number(t.amount), 0);
    document.getElementById('profFees').innerText = `₹${totalPaid.toLocaleString('en-IN')}`;
    document.getElementById('profTransList').innerHTML = personalFees.map(t => `<li>${t.date}: ₹${t.amount}</li>`).join('') || 'No records';
    openModal('profileModal');
}

function handleStudentSubmit() {
    const id = document.getElementById('editStudentId').value;
    const name = document.getElementById('newStuName').value;
    const course = document.getElementById('newStuCourse').value;
    const date = document.getElementById('newStuJoinDate').value;
    const status = document.getElementById('newStuStatus').value;

    if (!name || !course) return alert("Please fill Name and Course");

    if (id) {
        const idx = students.findIndex(s => s.id === id);
        students[idx] = { ...students[idx], name, course, joiningDate: date, status };
    } else {
        students.push({ id: Date.now().toString().slice(-4), name, course, joiningDate: date, status: "Active" });
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
    document.getElementById('newStuJoinDate').value = new Date().toISOString().split('T')[0];
    openModal('studentModal');
}

function openUpdateModal(id) {
    const s = students.find(st => st.id === id);
    document.getElementById('modalTitle').innerText = "Update Student";
    document.getElementById('editStudentId').value = s.id;
    document.getElementById('newStuName').value = s.name;
    document.getElementById('newStuCourse').value = s.course;
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
function resetSystem() { if(confirm("This will PERMANENTLY delete all data. Continue?")) { localStorage.clear(); location.reload(); } }
