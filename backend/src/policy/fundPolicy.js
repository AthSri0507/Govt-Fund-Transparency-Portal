// Simple fund transaction policy rules
module.exports.validateFundTransaction = function ({ project, amount }) {
  if (!project) return { allowed: false, reason: 'Missing project' };
  const status = project.status || '';
  const st = String(status).toLowerCase();
  if (st === 'halted' || st === 'disabled') {
    return { allowed: false, reason: 'Project is not accepting funds (status: ' + status + ')' };
  }
  const total = Number(project.budget_total || 0);
  const used = Number(project.budget_used || 0);
  const remaining = Math.max(0, total - used);
  if (amount > remaining) {
    return { allowed: false, reason: 'Insufficient remaining budget' };
  }
  // high amount warning threshold
  if (amount > 10000) {
    return { allowed: true, warning: 'High amount transaction' };
  }
  return { allowed: true };
};
