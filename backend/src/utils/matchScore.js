/**
 * Rule-based resume/job match scoring (ported from Express routes/matches.js)
 */

function parseSkills(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const p = JSON.parse(val);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function calculateMatchScore(resume, job) {
  let score = 0;
  const resumeSkills = parseSkills(resume.skills);
  const requiredSkills = parseSkills(job.required_skills);
  const preferredSkills = parseSkills(job.preferred_skills);

  const requiredMatch = resumeSkills.filter((skill) =>
    requiredSkills.some((rs) => rs.toLowerCase() === skill.toLowerCase())
  ).length;
  const preferredMatch = resumeSkills.filter((skill) =>
    preferredSkills.some((ps) => ps.toLowerCase() === skill.toLowerCase())
  ).length;

  const skillsScore = Math.min(
    40,
    (requiredMatch / Math.max(requiredSkills.length, 1)) * 30 +
      (preferredMatch / Math.max(preferredSkills.length, 1)) * 10
  );
  score += skillsScore;

  if (resume.experience_years && job.experience_level) {
    const expMap = { entry: 0, junior: 1, mid: 3, senior: 5, executive: 10 };
    const requiredExp = expMap[job.experience_level.toLowerCase()] || 0;
    const candidateExp = resume.experience_years;
    if (candidateExp >= requiredExp) {
      score += 30;
    } else {
      score += (candidateExp / Math.max(requiredExp, 1)) * 30;
    }
  }

  if (resume.education && job.description) {
    const educationKeywords = ['degree', 'bachelor', 'master', 'phd', 'diploma'];
    const hasEducation = educationKeywords.some((keyword) =>
      resume.education.toLowerCase().includes(keyword)
    );
    if (hasEducation) score += 20;
  }

  if (resume.summary && job.description) {
    const summaryWords = resume.summary.toLowerCase().split(/\s+/);
    const descWords = job.description.toLowerCase().split(/\s+/);
    const commonWords = summaryWords.filter((word) => descWords.includes(word));
    const matchRatio = commonWords.length / Math.max(descWords.length, 1);
    score += matchRatio * 10;
  }

  return Math.round(score);
}

export function countSkillsMatch(resume, job) {
  const resumeSkills = parseSkills(resume.skills);
  const requiredSkills = parseSkills(job.required_skills);
  return (
    resumeSkills.filter((skill) =>
      requiredSkills.some((rs) => rs.toLowerCase() === skill.toLowerCase())
    ).length || 0
  );
}
