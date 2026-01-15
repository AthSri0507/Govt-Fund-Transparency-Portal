// Simple risk scoring for transactions
module.exports.scoreRisk = function ({ amount = 0, frequency = 0 }) {
  let score = 0;
  const reasons = [];
  if (amount > 10000) { score += 5; reasons.push('Large amount'); }
  if (frequency > 3) { score += 3; reasons.push('High frequency'); }
  return { score, reasons };
};
