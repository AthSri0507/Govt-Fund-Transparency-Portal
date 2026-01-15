// Project-level policy rules
module.exports.validateProjectAction = function ({ action, project, newStatus }) {
  if (!project) return { allowed: false, reason: 'Missing project' };
  const status = project.status || '';
  const st = String(status).toLowerCase();
  if (action === 'disable') {
    if (st === 'disabled' || project.is_deleted) return { allowed: false, reason: 'Already disabled' };
    return { allowed: true };
  }
  if (action === 'restore') {
    if (!project.is_deleted && st !== 'disabled') return { allowed: false, reason: 'Project is not deleted/disabled' };
    return { allowed: true };
  }
  if (action === 'status_change') {
    const allowed = ['Active', 'Halted', 'Cancelled'];
    if (!newStatus || !allowed.includes(newStatus)) return { allowed: false, reason: 'Invalid status' };
    if (st === String(newStatus).toLowerCase()) return { allowed: false, reason: 'Already in requested status' };
    return { allowed: true };
  }
  return { allowed: true };
};
