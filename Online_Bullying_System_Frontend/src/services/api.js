import axios from "axios";

const BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5001/api";
export const API_BASE = BASE;
export const API_ORIGIN = BASE.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
});

// Optional: set auth token for protected endpoints
export function setAuthToken(token) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

// Auth
export async function login(identifier, password) {
  const res = await api.post("/auth/login", { email: identifier, username: identifier, password });
  return res.data;
}

// Users
export async function getUsers() {
  const res = await api.get("/users");
  return res.data;
}

export async function getUser(id) {
  const res = await api.get(`/users/${id}`);
  return res.data;
}

export async function createUser(payload) {
  // payload: { username, email, password, role? }
  const res = await api.post("/users", payload);
  return res.data;
}

export async function updateUser(id, payload) {
  // payload can include { username, email, password, role }
  const res = await api.put(`/users/${id}`, payload);
  return res.data;
}

export async function deleteUser(id) {
  const res = await api.delete(`/users/${id}`);
  return res.data;
}

export async function getStudents() {
  const res = await api.get("/admin/students");
  return res.data;
}

export async function inviteStudent(payload) {
  const res = await api.post("/admin/students", payload);
  return res.data;
}

export async function updateStudent(id, payload) {
  const res = await api.patch(`/admin/students/${id}`, payload);
  return res.data;
}

export async function resetStudentPassword(id) {
  const res = await api.post(`/admin/students/${id}/reset_password`);
  return res.data;
}

export async function deleteStudent(id) {
  const res = await api.delete(`/admin/students/${id}`);
  return res.data;
}

export async function inviteAdmin(payload) {
  const res = await api.post("/admin/admins", payload);
  return res.data;
}

export async function changeUserPassword(id, payload) {
  const res = await api.post(`/users/${id}/password`, payload);
  return res.data;
}

export async function uploadUserAvatar(id, imageData) {
  const res = await api.post(`/users/${id}/avatar`, { image: imageData });
  return res.data;
}

export async function deleteUserAvatar(id) {
  const res = await api.delete(`/users/${id}/avatar`);
  return res.data;
}

// Complaints
export async function createComplaint(payload) {
  const res = await api.post("/complaints", payload);
  return res.data;
}

export async function getComplaints(params = {}) {
  const res = await api.get("/complaints", { params });
  return res.data;
}

export async function addComplaintComment(complaintId, payload) {
  const res = await api.post(`/complaints/${complaintId}/comments`, payload);
  return res.data;
}

export async function updateComplaintStatus(complaintId, status) {
  const payload =
    typeof status === "string"
      ? { status }
      : { status: status?.status || status?.value || status };
  const res = await api.patch(`/complaints/${complaintId}/status`, payload);
  return res.data;
}

export async function getComplaintById(id) {
  const res = await api.get(`/complaints/${id}`);
  return res.data;
}

export async function getComplaintComments(complaintId) {
  const res = await api.get(`/complaints/${complaintId}/comments`);
  return res.data;
}

export function toAbsoluteUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_ORIGIN}${normalized}`;
}

// Convenience: find first student and set role to admin
export async function promoteFirstStudentToAdmin() {
  const users = await getUsers();
  const student = users.find(u => u && (u.role === "student" || u.role === "Student"));
  if (!student) throw new Error("No student found");
  const updated = await updateUser(student.id, { role: "admin" });
  return updated;
}

export default api;
