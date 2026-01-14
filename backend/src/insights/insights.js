const { getMongo } = require('../db_mongo');
const db = require('../db_mysql');

const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','have','are','was','but','not','you','your','our','they','their','has','had','its','will','were','been','what','when','where'
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/["'`<>@#$/\\\^&*()\[\]_+=~\|:;,.!?-]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

function ngrams(tokens, n) {
  const out = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i+n).join(' '));
  return out;
}

async function computeInsightsForProject(projectId) {
  // gather comments from MySQL
  const comments = await db.query('SELECT id, text, rating, created_at, sentiment_summary_cached FROM comments WHERE project_id = ?', [projectId]);

  // gather processed raw feedback from Mongo (if present)
  const mongo = await getMongo();
  const raw = await mongo.collection('raw_feedback').find({ project_id: Number(projectId), processed: true }).toArray();

  const texts = [];
  const byId = {};
  for (const c of comments) {
    const t = c.text || '';
    texts.push(t);
    byId[c.id] = c;
  }
  for (const r of raw) {
    if (r.text) texts.push(r.text);
  }

  const tokenFreq = Object.create(null);
  const phraseFreq = Object.create(null);

  for (const t of texts) {
    const toks = tokenize(t);
    for (const w of toks) tokenFreq[w] = (tokenFreq[w] || 0) + 1;
    for (const b of ngrams(toks, 2)) phraseFreq[b] = (phraseFreq[b] || 0) + 1;
    for (const tr of ngrams(toks, 3)) phraseFreq[tr] = (phraseFreq[tr] || 0) + 1;
  }

  const topKeywords = Object.entries(tokenFreq).sort((a,b)=>b[1]-a[1]).slice(0,10).map(e=>({ word: e[0], count: e[1]}));
  const topPhrases = Object.entries(phraseFreq).filter(e=>e[1] > 1).sort((a,b)=>b[1]-a[1]).slice(0,10).map(e=>({ phrase: e[0], count: e[1]}));

  // sentiment summary from cached comment values
  const scores = [];
  const posPhrases = Object.create(null);
  const negPhrases = Object.create(null);
  for (const c of comments) {
    let s = null;
    if (c.sentiment_summary_cached) {
      try { s = typeof c.sentiment_summary_cached === 'string' ? JSON.parse(c.sentiment_summary_cached) : c.sentiment_summary_cached; } catch (e) { s = c.sentiment_summary_cached; }
    }
    if (s && typeof s.score === 'number') scores.push(s.score);
    const toks = tokenize(c.text || '');
    const phs = ngrams(toks,2).concat(ngrams(toks,3));
    if (s && typeof s.score === 'number' && s.score > 0) {
      for (const p of phs) posPhrases[p] = (posPhrases[p] || 0) + 1;
    }
    if (s && typeof s.score === 'number' && s.score < 0) {
      for (const p of phs) negPhrases[p] = (negPhrases[p] || 0) + 1;
    }
  }

  const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length) : null;
  const totalComments = comments.length;

  // build human-friendly summary
  let predominant = 'neutral';
  if (avg !== null) {
    if (avg > 0.1) predominant = 'positive';
    else if (avg < -0.1) predominant = 'negative';
  }
  const topPos = Object.entries(posPhrases).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);
  const topNeg = Object.entries(negPhrases).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);

  let summary_text = '';
  if (avg === null) summary_text = 'Not enough processed comments to generate insights.';
  else {
    const avgRounded = Math.round(avg*100)/100;
    summary_text = `Overall sentiment is ${predominant} (avg score ${avgRounded}) across ${totalComments} comments.`;
    if (topPhrases.length) summary_text += ` Common themes include ${topPhrases.slice(0,3).map(p=>p.phrase).join(', ')}.`;
    if (topPos.length) summary_text += ` Positive highlights: ${topPos.join('; ')}.`;
    if (topNeg.length) summary_text += ` Negative highlights: ${topNeg.join('; ')}.`;
  }

  const confidence = Math.min(1, totalComments / 50);

  // Phase 2: Opinion clustering, topic detection, trend over time, improved confidence, explainability

  // Build token sets per comment for clustering/topics
  const commentTokenSets = {};
  for (const c of comments) {
    commentTokenSets[c.id] = new Set(tokenize(c.text || ''));
  }

  function jaccard(aSet, bSet) {
    if (!aSet || !bSet) return 0;
    let inter = 0;
    for (const v of aSet) if (bSet.has(v)) inter++;
    const union = aSet.size + bSet.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  // Greedy clustering based on Jaccard similarity
  const clusters = [];
  const assigned = new Set();
  const CLUSTER_THRESHOLD = 0.25;
  for (const c of comments) {
    if (assigned.has(c.id)) continue;
    const cluster = { ids: [c.id], keywords: {}, phrases: {} };
    assigned.add(c.id);
    const aSet = commentTokenSets[c.id];
    for (const o of comments) {
      if (assigned.has(o.id)) continue;
      const bSet = commentTokenSets[o.id];
      if (jaccard(aSet, bSet) >= CLUSTER_THRESHOLD) {
        cluster.ids.push(o.id);
        assigned.add(o.id);
      }
    }
    // compute top keywords/phrases for cluster
    for (const id of cluster.ids) {
      const toks = Array.from(commentTokenSets[id] || []);
      for (const t of toks) cluster.keywords[t] = (cluster.keywords[t] || 0) + 1;
      const phs = ngrams(toks,2).concat(ngrams(toks,3));
      for (const p of phs) cluster.phrases[p] = (cluster.phrases[p] || 0) + 1;
    }
    const topK = Object.entries(cluster.keywords).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);
    const topP = Object.entries(cluster.phrases).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);
    clusters.push({ size: cluster.ids.length, ids: cluster.ids, top_keywords: topK, top_phrases: topP });
  }

  // Topic detection: group common phrases/tokens into topics
  const phraseToCount = Object.entries(phraseFreq).map(e=>({ phrase: e[0], count: e[1] }));
  const topics = [];
  const phraseAssigned = new Set();
  for (const p of phraseToCount) {
    if (phraseAssigned.has(p.phrase)) continue;
    const tokens = p.phrase.split(' ');
    const topic = { phrases: [p.phrase], keywords: {}, score: p.count };
    phraseAssigned.add(p.phrase);
    for (const q of phraseToCount) {
      if (phraseAssigned.has(q.phrase)) continue;
      const qtoks = q.phrase.split(' ');
      // if share any token, join topic
      if (tokens.some(t=>qtoks.includes(t))) {
        topic.phrases.push(q.phrase);
        topic.score += q.count;
        phraseAssigned.add(q.phrase);
      }
    }
    // keywords for topic
    for (const ph of topic.phrases) for (const tk of ph.split(' ')) topic.keywords[tk] = (topic.keywords[tk]||0)+1;
    const topK = Object.entries(topic.keywords).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);
    topics.push({ phrases: topic.phrases, top_keywords: topK, score: topic.score });
  }

  // Trend over time: compute average sentiment per day and slope
  const dayBuckets = Object.create(null);
  for (const c of comments) {
    let s = null;
    if (c.sentiment_summary_cached) {
      try { s = typeof c.sentiment_summary_cached === 'string' ? JSON.parse(c.sentiment_summary_cached) : c.sentiment_summary_cached; } catch (e) { s = c.sentiment_summary_cached; }
    }
    if (s && typeof s.score === 'number' && c.created_at) {
      const d = new Date(c.created_at);
      const day = Math.floor(d.getTime() / 86400000);
      if (!dayBuckets[day]) dayBuckets[day] = { sum: 0, count: 0 };
      dayBuckets[day].sum += s.score;
      dayBuckets[day].count += 1;
    }
  }
  const points = Object.entries(dayBuckets).map(([day, v]) => ({ x: Number(day), y: v.sum / v.count, n: v.count })).sort((a,b)=>a.x-b.x);
  let trend = { label: 'insufficient_data', slope: 0, points: points.map(p=>({ day: p.x, avg: p.y, n: p.n })) };
  if (points.length >= 3) {
    const xs = points.map(p=>p.x);
    const ys = points.map(p=>p.y);
    const meanX = xs.reduce((a,b)=>a+b,0)/xs.length;
    const meanY = ys.reduce((a,b)=>a+b,0)/ys.length;
    let num = 0, den = 0;
    for (let i=0;i<xs.length;i++) { num += (xs[i]-meanX)*(ys[i]-meanY); den += (xs[i]-meanX)*(xs[i]-meanX); }
    const slope = den === 0 ? 0 : num/den;
    let label = 'stable';
    if (slope > 0.01) label = 'improving'; else if (slope < -0.01) label = 'declining';
    trend = { label, slope, points: points.map(p=>({ day: p.x, avg: p.y, n: p.n })) };
  }

  // improved confidence: base on count, penalize high variance
  let confidence2 = Math.min(1, totalComments / 100);
  if (scores.length > 1) {
    const mean = scores.reduce((a,b)=>a+b,0)/scores.length;
    const variance = scores.reduce((a,b)=>a+(b-mean)*(b-mean),0)/(scores.length-1);
    const penalty = Math.min(0.5, variance/4); // scale
    confidence2 = Math.max(0, confidence2 * (1 - penalty));
  }

  const insights = {
    project_id: Number(projectId),
    generated_at: new Date(),
    total_comments: totalComments,
    average_score: avg,
    confidence: confidence2,
    top_keywords: topKeywords,
    top_phrases: topPhrases,
    positive_highlights: topPos,
    negative_highlights: topNeg,
    summary_text,
    clusters,
    topics,
    trend,
    explainability: {
      top_keywords: topKeywords.slice(0,10),
      top_phrases: topPhrases.slice(0,10),
      clusters: clusters.map(c=>({ size: c.size, top_keywords: c.top_keywords, sample_ids: c.ids.slice(0,5) })),
      topics: topics.map(t=>({ top_keywords: t.top_keywords, phrases: t.phrases.slice(0,5) }))
    }
  };

  // store into Mongo feedback_insights collection (upsert by project_id)
  await mongo.collection('feedback_insights').updateOne({ project_id: Number(projectId) }, { $set: insights, $setOnInsert: { created_at: new Date() } }, { upsert: true });

  return insights;
}

async function getInsights(projectId) {
  const mongo = await getMongo();
  return await mongo.collection('feedback_insights').findOne({ project_id: Number(projectId) });
}

module.exports = { computeInsightsForProject, getInsights };
