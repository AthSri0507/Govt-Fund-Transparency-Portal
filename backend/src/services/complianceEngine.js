const fundPolicy = require('../policy/fundPolicy');
const projectPolicy = require('../policy/projectPolicy');
const riskEvaluator = require('./riskEvaluator');

function bucketRiskLevel(score) {
  if (score >= 8) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  return 'LOW';
}

module.exports.evaluate = function (actionType, context) {
  if (actionType === 'fund_transaction') {
    const decision = fundPolicy.validateFundTransaction(context);
    // compute risk (score + reasons)
    const r = riskEvaluator.scoreRisk({ amount: context.amount, frequency: context.frequency || 0 });
    const riskScore = r && typeof r.score === 'number' ? r.score : 0;
    const riskReasons = Array.isArray(r && r.reasons) ? r.reasons.slice() : [];
    // if project is flagged, increase severity and reason
    if (context.project && (context.project.is_flagged || context.project.isFlagged || context.project.flagged)) {
      // bump score heuristically
      riskReasons.push('Project flagged');
      // increase score
      // (not to exceed a small bump)
      const bumped = Math.min(10, riskScore + 2);
      return { ...decision, riskScore: bumped, risk_level: bucketRiskLevel(bumped), risk_reasons: riskReasons };
    }
    return { ...decision, riskScore, risk_level: bucketRiskLevel(riskScore), risk_reasons: riskReasons };
  }
  if (actionType === 'project_action') {
    const decision = projectPolicy.validateProjectAction(context);
    return decision;
  }
  return { allowed: true };
};
