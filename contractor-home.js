const userId = localStorage.getItem('userId');

if (!userId) {
  alert("Please log in first.");
  window.location.href = 'login.html';
}

let editingProjectId = null;
let editingType = null;

function showSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(id + '-section').classList.add('active');
}

document.getElementById('btnHome').onclick = () => showSection('home');
document.getElementById('btnProfile').onclick = () => showSection('profile');
document.getElementById('btnLogout').onclick = () => {
  localStorage.removeItem('userId');
  window.location.href = 'home.html';
};

async function loadProjects() {
  const res = await fetch(`http://localhost:3000/projects/${userId}`);
  const projects = await res.json();
  const cons = document.getElementById('contractCards');
  const dals = document.getElementById('dailyCards');
  cons.innerHTML = '';
  dals.innerHTML = '';

  projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <h3>${p.name}</h3>
      <p><strong>ID:</strong> ${p.id}</p>
      ${p.deadline ? `<p>Deadline: ${new Date(p.deadline).toLocaleDateString()}</p>` : ''}
      <div class="actions">
        <span title="Edit" onclick='openModal("${p.type}", ${p.id})'>✏️</span>
        <span title="Delete" onclick='deleteProject(${p.id})'>🗑️</span>
        <span title="Open Project" onclick='openProject(${p.id})'>📂</span>
      </div>
    `;
    if (p.type === 'contract') cons.appendChild(card);
    else dals.appendChild(card);
  });
}

async function openProject(projectId) {
  localStorage.setItem('selectedProjectId', projectId);
  window.location.href = 'project demo.html?id=' + projectId;
}

async function openModal(type, projectId = null) {
  editingProjectId = projectId;
  editingType = type;

  document.getElementById('modalTitle').innerText = projectId
    ? 'Edit Project'
    : `Add ${type.charAt(0).toUpperCase() + type.slice(1)} Project`;

  // Show or hide relevant fields based on project type
  const deadlineField = document.getElementById('projectDeadline');
  const amountField = document.getElementById('projectAmount');
  deadlineField.style.display = type === 'contract' ? 'block' : 'none';
  amountField.style.display = type === 'contract' ? 'block' : 'none';

  // Reset form
  document.getElementById('projectName').value = '';
  deadlineField.value = '';
  amountField.value = '';

  // If editing, fetch and populate data
  if (projectId) {
    try {
      const res = await fetch(`http://localhost:3000/project/${projectId}`);
      const project = await res.json();

      document.getElementById('projectName').value = project.name;
      if (type === 'contract') {
        deadlineField.value = project.deadline?.split('T')[0] || '';
        amountField.value = project.total_amount || '';
      }
    } catch (err) {
      alert('Failed to load project data');
      console.error(err);
      return;
    }
  }
  document.getElementById('projectModal').style.display = 'flex';
}



document.querySelectorAll('.action-btn').forEach(btn => {
  btn.addEventListener('click', () => openModal(btn.dataset.type));
});

document.getElementById('cancelProjectBtn').onclick = () => {
  editingProjectId = null;
  document.getElementById('projectModal').style.display = 'none';
};

document.getElementById('saveProjectBtn').onclick = async () => {
  const name = document.getElementById('projectName').value.trim();
  const deadline = document.getElementById('projectDeadline').value;
  const total_amount = document.getElementById('projectAmount').value;

  if (!name) return alert('Project name required');
  if (editingType === 'contract' && (!deadline || !total_amount)) {
    return alert('Contract projects require deadline and amount');
  }

  const payload = { name, type: editingType, user_id: userId };
  if (editingType === 'contract') {
    payload.deadline = deadline;
    payload.total_amount = parseFloat(total_amount);
  }

  const method = editingProjectId ? 'PUT' : 'POST';
  const url = editingProjectId
    ? `http://localhost:3000/projects/${editingProjectId}`
    : `http://localhost:3000/projects`;

  try {
    await fetch(url, {
      method,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    document.getElementById('projectModal').style.display = 'none';
    loadProjects();
  } catch {
    alert('Failed to save project');
  }
};

async function deleteProject(id) {
  if (!confirm('Are you sure you want to delete this project? It will be moved to the bin.')) return;

  try {
    const response = await fetch('http://localhost:3000/delete-projects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectIds: [id] })
    });

    const result = await response.json();
    alert(result.message || 'Project deleted.');
    loadProjects(); // Refresh UI
  } catch (err) {
    console.error('Delete failed', err);
    alert('Failed to delete the project.');
  }
}


async function loadProfile() {
  try {
    const res = await fetch(`http://localhost:3000/user/${userId}`);
    const user = await res.json();
    document.getElementById('profileDetails').innerHTML = `
      <p><strong>Name:</strong> ${user.name}</p><br>
      <p><strong>Email:</strong> ${user.email}</p><br>
      <p><strong>Phone:</strong> ${user.phone}</p><br>
      <p><strong>Address:</strong> ${user.address}</p><br>
    `;
  } catch {
    document.getElementById('profileDetails').innerText = 'Failed to load profile';
  }
}

document.getElementById('editProfileBtn').onclick = async () => {
  try {
    const res = await fetch(`http://localhost:3000/user/${userId}`);
    const user = await res.json();

    document.getElementById('editName').value = user.name;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editPhone').value = user.phone;
    document.getElementById('editAddress').value = user.address;

    document.getElementById('profileModal').style.display = 'flex';
  } catch (err) {
    alert('Failed to load user details for editing');
  }
};

document.getElementById('cancelProfileBtn').onclick = () => {
  document.getElementById('profileModal').style.display = 'none';
};

document.getElementById('saveProfileBtn').onclick = async () => {
  const name = document.getElementById('editName').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const phone = document.getElementById('editPhone').value.trim();
  const address = document.getElementById('editAddress').value.trim();

  if (!name || !email || !phone || !address) {
    return alert('All fields are required.');
  }

  try {
    await fetch(`http://localhost:3000/user/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, address })
    });

    alert('Profile updated successfully.');
    document.getElementById('profileModal').style.display = 'none';
    loadProfile();
  } catch (err) {
    alert('Failed to update profile.');
  }
};


showSection('home');
loadProjects();

document.getElementById('btnProfile').addEventListener('click', loadProfile);
