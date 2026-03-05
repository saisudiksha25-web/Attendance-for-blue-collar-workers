const pid = new URLSearchParams(window.location.search).get('id');
    let projectData;
    let selectedCategory = '';

    function showSection(id) {
      // Hide all sections
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      // Show only the selected section
      document.getElementById(id).classList.add('active');

      // Special logic for attendance section
      if (id === 'attendance') {
        populateAttendanceLists();
      }
      // Special logic for project section
      if (id === 'project') {
        document.getElementById('workerAttendanceData').style.display = 'none';
        document.getElementById('projectMainContent').style.display = 'flex';
      }
    }

    function openAddWorkerPopup(workerType) {
      selectedCategory = workerType;
      document.getElementById('workerNameInput').value = '';
      document.getElementById('workerModal').style.display = 'flex';
    }

    function openPaymentModal() {
      const isContract = projectData.type === 'contract';
      document.getElementById('totalAmountInput').disabled = isContract;
      document.getElementById('pendingAmountInput').disabled = isContract;

      document.getElementById('totalAmountInput').value = projectData.total_amount || 0;
      document.getElementById('receivedAmountInput').value = projectData.amount_received || 0;
      document.getElementById('pendingAmountInput').value = projectData.pending_amount || 0;

      document.getElementById('paymentModal').style.display = 'flex';
    }

    function closeModal(id) {
      document.getElementById(id).style.display = 'none';
    }

    async function saveWorker() {
      const name = document.getElementById('workerNameInput').value.trim();
      if (!name) return alert("Enter a name");

      const res = await fetch(`/project/${pid}/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: selectedCategory })
      });

      if (res.ok) {
        loadProject();
        closeModal('workerModal');
      } else {
        alert('Error adding worker');
      }
    }

    async function savePayment() {
      const isContract = projectData.type === 'contract';
      const received = parseFloat(document.getElementById('receivedAmountInput').value);
      const pending = isContract
        ? (projectData.total_amount || 0) - received
        : parseFloat(document.getElementById('pendingAmountInput').value);

      const res = await fetch(`/projects/${pid}/payments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received, pending })
      });

      if (res.ok) {
        loadProject();
        closeModal('paymentModal');
      } else {
        alert('Error updating payment');
      }
    }

    // individual worker attendance display
    // Assigning to window to ensure global access
    window.displayWorkerAttendance = function (workerId, workerName) {
  const projectId = new URLSearchParams(window.location.search).get('id');
  const container = document.getElementById('workerAttendanceData');

  // Hide main project content
  document.getElementById('projectMainContent').style.display = 'none';
  container.style.display = 'block';

  // Initial Loading UI
  container.innerHTML = `
    <button onclick="window.goBackToProjectView()" style="margin-bottom: 10px;">← Back</button>
    <h2>Attendance for ${workerName}</h2>
    <p>Loading...</p>
  `;

  fetch(`/project/${projectId}/attendance/worker/${workerId}`)
    .then(response => response.json())
    .then(data => {
      if (!data || !data.records || data.records.length === 0) {
        container.innerHTML += `<p>No attendance records found.</p>`;
        return;
      }

      const totalSessions = data.totalSessions;
      const presentSessions = data.presentSessions;
      const attendancePercent = data.percentage;

      const summary = `
        <h3>Summary</h3>
        <table border="1" cellpadding="8" cellspacing="0">
          <thead>
            <tr>
              <th>Worker Name</th>
              <th>Total Sessions</th>
              <th>Present Sessions</th>
              <th>Attendance %</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${workerName}</td>
              <td>${totalSessions}</td>
              <td>${presentSessions}</td>
              <td>${attendancePercent}%</td>
            </tr>
          </tbody>
        </table>
      `;

      let attendanceTable = `
        <h3>Detailed Attendance</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="width: 100%;">
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
      `;
      data.records.forEach(record => {
        attendanceTable += `<tr><td>${record.date}</td><td>${record.status}</td></tr>`;
      });
      attendanceTable += `</tbody></table>`;

      let absentTable = '';
      if (data.absents && data.absents.length > 0) {
        absentTable = `
          <h3>Absent Dates</h3>
          <table border="1" cellpadding="8" cellspacing="0" style="width: 100%;">
            <thead>
              <tr>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
        `;
        data.absents.forEach(date => {
          absentTable += `<tr><td>${date}</td></tr>`;
        });
        absentTable += `</tbody></table>`;
      } else {
        absentTable = `<p style="margin-top: 20px;">No absent days recorded.</p>`;
      }

      // Combine all
      container.innerHTML = `
        <button onclick="window.goBackToProjectView()" style="margin-bottom: 10px;">← Back</button>
        <h2>Attendance for ${workerName}</h2>
        ${summary}
        <div style="display: flex; gap: 40px; align-items: flex-start; margin-top: 30px;">
          <div style="flex: 1;">${attendanceTable}</div>
          <div style="flex: 1;">${absentTable}</div>
        </div>
      `;
    })
    .catch(err => {
      console.error(err);
      container.innerHTML += `<p style="color:red;">Failed to load attendance data.</p>`;
    });
};



    // Also attach goBackToProject to window
    window.goBackToProjectView = function () {
      document.getElementById('workerAttendanceData').style.display = 'none';
      document.getElementById('projectMainContent').style.display = 'flex';
    };





      async function loadProject() {
        const res = await fetch(`/project/${pid}`);
        projectData = await res.json();

        const dl = projectData.deadline && projectData.type !== 'daily' ? projectData.deadline : null;
        document.getElementById('deadlineDisplay').innerText = dl ? 'Deadline: ' + formatDate(dl) : 'Deadline: N/A';

        document.getElementById('receivedAmount').innerText = '₹' + (projectData.amount_received || 0);
        const pending = projectData.type === 'contract'
          ? (projectData.total_amount || 0) - (projectData.amount_received || 0)
          : projectData.pending_amount || 0;
        document.getElementById('pendingAmount').innerText = '₹' + pending;

        const resw = await fetch(`/project/${pid}/workers`);
        const workers = await resw.json();

        document.getElementById('contractList').innerHTML = '';
        document.getElementById('dailyList').innerHTML = '';

        workers.forEach(w => {
          const li = document.createElement('li');
          li.textContent = `${w.name} (ID: ${w.id})`;
          li.style.cursor = 'pointer';
          li.onclick = () => window.displayWorkerAttendance(w.id, w.name);
          if (w.category === 'contract') {
            document.getElementById('contractList').appendChild(li);
          } else if (w.category === 'daily') {
            document.getElementById('dailyList').appendChild(li);
          }
        });
      }

      // Populate Attendance Lists
      async function populateAttendanceLists() {
        try {
          const res = await fetch(`/project/${pid}/workers`);
          if (!res.ok) throw new Error("Failed to fetch workers");

          const workers = await res.json();
          const contractList = document.getElementById('contractAttendanceList');
          const dailyList = document.getElementById('dailyAttendanceList');

          contractList.innerHTML = '';
          dailyList.innerHTML = '';

          workers.forEach(w => {
            const li = document.createElement('li');
            li.innerHTML = `
              <label>${w.name} (ID: ${w.id})</label>
              <input type="checkbox" id="att_${w.id}_1" title="First Half" />
              <input type="checkbox" id="att_${w.id}_2" title="Second Half" />
            `;

            if (w.category === 'contract') {
              contractList.appendChild(li);
            } else if (w.category === 'daily') {
              dailyList.appendChild(li);
            }
          });
        } catch (error) {
          console.error("Error loading workers:", error);
        }
      }


    // Run this once page loads
    window.onload = function () {
      populateAttendanceLists();
    };

    // Submit Attendance
    async function submitAttendance() {
      const date = document.getElementById('attendanceDate').value;
      if (!date) return alert('Please select a date.');

      try {
        const res = await fetch(`/project/${pid}/workers`);
        const workers = await res.json();

        const presentWorkers = [];

        workers.forEach(w => {
          const cb1 = document.getElementById(`att_${w.id}_1`);
          const cb2 = document.getElementById(`att_${w.id}_2`);

          if (!cb1 || !cb2) return;

          let status = '';
          if (cb1.checked && cb2.checked) status = 'full';
          else if (cb1.checked || cb2.checked) status = 'half';
          else return; // skip absent

          presentWorkers.push({
            id: w.id,
            name: w.name,
            category: w.category,
            status
          });
        });



        const response = await fetch(`/project/${pid}/attendance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            date,
            presentWorkers
          })
        });

        const text = await response.text();
        if (response.ok) {
          alert("Attendance saved successfully");
          location.reload();
        } else {
          console.error("Response error:", text);
          alert("Something went wrong");
        }

      } catch (err) {
        console.error("Fetch error:", err);
        alert("Something went wrong");
      }
    }

    //current date in attendance page
    /* window.onload = function () {
        populateAttendanceLists();
        document.getElementById('attendanceDate').valueAsDate = new Date();
      };
    */

    // Filter Attendance
    async function filterAttendance() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const type = document.getElementById('filterType').value;

        if (!startDate || !endDate) {
            alert("Please select both start and end dates");
            return;
        }

        try {
            console.log("📡 Sending request to backend with:", startDate, endDate, type);
            const url = `/project/${pid}/attendance?start=${startDate}&end=${endDate}&type=${type}`;
            const res = await fetch(url);
            const data = await res.json();
            console.log("Filtered Attendance Response:", data);

            const container = document.getElementById('filterResults');
            container.innerHTML = '';

            let workerMap = {};  // key: id, value: {id, name, category, dates: [], statuses: [], score: 0}

            // 1. Prepare worker data
            data.forEach(entry => {
            const date = entry.date;
            entry.present_workers.forEach(worker => {
                const { id, name, status, category } = worker;
                if (!workerMap[id]) {
                workerMap[id] = {
                    id,
                    name,
                    category,
                    dates: [],
                    statuses: [],
                    score: 0
                };
                }

                // Mark date and status
                workerMap[id].dates.push(date);
                workerMap[id].statuses.push(status);

                // Score update
                if (status === 'full') workerMap[id].score += 2;
                else if (status === 'half') workerMap[id].score += 1;
                // if absent, score += 0
            });
            });

            // 2. Fill absent for missing dates
            let allDates = [...new Set(data.map(entry => entry.date))].sort((a, b) => a.localeCompare(b));
            Object.values(workerMap).forEach(worker => {
            allDates.forEach(date => {
                if (!worker.dates.includes(date)) {
                worker.dates.push(date);
                worker.statuses.push('absent');
                }
            });

            // Reorder by date
            const combined = worker.dates.map((d, i) => ({ date: d, status: worker.statuses[i] }));
            combined.sort((a, b) => a.date.localeCompare(b.date));
            worker.dates = combined.map(c => c.date);
            worker.statuses = combined.map(c => c.status);
            });

            // 3. Build detailed tables
            function buildDetailedTable(category, title) {
            const workers = Object.values(workerMap).filter(w => w.category === category);
            if (!workers.length) return `<h3>${title}</h3><p>No workers</p>`;

            // Table Header
            let table = `
                <h3>${title} - Detailed Attendance</h3>
                <table class="styled-table">
                <thead>
                    <tr>
                    <th>ID</th><th>Name</th><th>Category</th>
                    ${allDates.map(date => `<th>${date}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
            `;

            // Table Rows
            workers.forEach(w => {
                table += `<tr>
                <td>${w.id}</td>
                <td>${w.name}</td>
                <td>${w.category}</td>
                ${w.statuses.map(s => `<td>${s}</td>`).join('')}
                </tr>`;
            });

            table += `</tbody></table>`;
            return table;
            }

            // 4. Build summary tables
            function buildSummaryTable(category, title) {
            const workers = Object.values(workerMap).filter(w => w.category === category);
            if (!workers.length) return `<h3>${title}</h3><p>No workers</p>`;

            const totalSessions = allDates.length * 2;

            let table = `
                <h3>${title} - Summary</h3>
                <table class="styled-table">
                <thead>
                    <tr>
                    <th>ID</th><th>Name</th><th>Total Sessions</th><th>Present Sessions</th><th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
            `;

            workers.forEach(w => {
                const percentage = ((w.score / totalSessions) * 100).toFixed(2);
                table += `
                <tr>
                    <td>${w.id}</td>
                    <td>${w.name}</td>
                    <td>${totalSessions}</td>
                    <td>${w.score}</td>
                    <td>${percentage}%</td>
                </tr>`;
            });

            table += `</tbody></table>`;
            return table;
            }

            // Append all four tables based on selected type
            if (type === 'contract' || type === 'both') {
            container.innerHTML += buildSummaryTable('contract', 'Contract Workers');
            container.innerHTML += buildDetailedTable('contract', 'Contract Workers');
            }

            if (type === 'daily' || type === 'both') {
            container.innerHTML += buildSummaryTable('daily', 'Daily Workers');
            container.innerHTML += buildDetailedTable('daily', 'Daily Workers');
            }

        } catch (err) {
            console.error('❌ Error fetching attendance:', err);
            alert("Failed to fetch filtered attendance. Please try again.");
        }
        }



// Load Attendance Sheet Section
async function loadAttendanceSheet() {
  showSection('attendanceSheet'); // This shows the 'attendanceSheet' div or section

  const container = document.getElementById('attendanceSheetContainer');
  container.innerHTML = 'Loading...';

  try {
    const res = await fetch(`/project/${pid}/attendance`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = "<p>No attendance records found.</p>";
      return;
    }

    // Generate buttons for each date
    const dateButtons = data.map(entry => {
      const date = entry.date;
      return `<button onclick="openAttendanceDetails('${date}')" class="attendance-date-btn">${date}</button>`;
    }).join('<br>');

    container.innerHTML = `
      <div class="attendance-dates">${dateButtons}</div>
      <div id="attendanceDetailsContainer"></div> <!-- For showing selected date's details -->
    `;
  } catch (err) {
    console.error("Error loading attendance sheet:", err);
    container.innerHTML = "Failed to load attendance data.";
  }
}



// Open date in a new tab (you can customize the target HTML page)
async function openAttendanceDetails(date) {
  const container = document.getElementById('attendanceSheetContainer');
  container.innerHTML = `<h3>Attendance for ${date}</h3><p>Loading...</p>`;

  try {
    const res = await fetch(`/project/${pid}/attendance?start=${date}&end=${date}&type=both`);
    const data = await res.json();
    const entry = data.find(d => d.date === date);

    if (!entry || !entry.present_workers || entry.present_workers.length === 0) {
      container.innerHTML = `<p>No present workers on this date.</p>`;
      container.innerHTML += `<br><button class="attendance-date-btn" onclick="loadAttendanceSheet()">Back to Dates</button>`;
      return;
    }

    // Separate workers by category
    const contractWorkers = entry.present_workers.filter(w => w.category === 'contract');
    const dailyWorkers = entry.present_workers.filter(w => w.category === 'daily');

    // HTML for worker table
    function buildTable(workers, categoryName) {
      if (workers.length === 0) return `<p>No ${categoryName} workers present.</p>`;

      let rows = workers.map(w => `
        <tr>
          <td>${w.id}</td>
          <td>${w.name}</td>
          <td>${w.status}</td>
        </tr>
      `).join('');

      return `
        <div class="worker-box">
          <h4>${categoryName} Workers</h4>
          <table class="styled-worker-table">
            <thead>
              <tr><th>ID</th><th>Name</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = `
      <h3>Attendance for ${date}</h3>
      ${buildTable(contractWorkers, "Contract")}
      ${buildTable(dailyWorkers, "Daily")}
      <br>
      <button class="attendance-date-btn" onclick="loadAttendanceSheet()">Back to Dates</button>
    `;

  } catch (err) {
    console.error("Error fetching attendance details:", err);
    container.innerHTML = `<p>Failed to load attendance details.</p>`;
    container.innerHTML += `<br><button class="attendance-date-btn" onclick="loadAttendanceSheet()">Back to Dates</button>`;
  }
}



     function formatDate(d) {
      const dt = new Date(d);
      return `${dt.getDate().toString().padStart(2,'0')}-${(dt.getMonth()+1).toString().padStart(2,'0')}-${dt.getFullYear()}`;
    }

    loadProject();