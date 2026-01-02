# Match Score Calculation Explained

## Overview
The match score is a percentage (0-100) that indicates how well a candidate matches a job posting. It's calculated automatically when jobs are created/updated or when candidates update their profiles.

## Score Components

The match score is calculated using three main factors:

### 1. Job Classification Match (Base Score: 50 points)
- **What it checks**: Whether the candidate's `job_classification` matches the job's `job_classification`
- **Points**: 50 points (base score)
- **How it works**: 
  - If candidate's `job_classification` ID equals job's `job_classification` ID → **+50 points**
  - This is the primary matching criteria - candidates must have the same job classification as the job

### 2. Skills Match (Up to 30 points)
- **What it checks**: How many of the job's required skills match the candidate's skills
- **Points**: Up to 30 points
- **How it works**:
  - Compares candidate's resume skills (from `resumes` table) with job's `required_skills`
  - Calculates: `(matching_skills_count / total_job_skills) * 30`
  - Example:
    - Job requires: `["JavaScript", "React", "Node.js"]` (3 skills)
    - Candidate has: `["JavaScript", "React", "Python"]` (2 matches)
    - Score: `(2 / 3) * 30 = 20 points`

### 3. Experience Match (Up to 20 points)
- **What it checks**: Whether candidate's years of experience meet the job's experience level requirement
- **Points**: Up to 20 points
- **How it works**:
  - Uses candidate's `years_of_experience` (from profile or resume)
  - Compares with job's `experience_level`:
    - `entry` → 0 years required
    - `junior` → 1 year required
    - `mid` → 3 years required
    - `senior` → 5 years required
    - `executive` → 10 years required
  - Scoring:
    - If candidate meets or exceeds requirement → **+20 points**
    - If candidate has less experience → `(candidate_years / required_years) * 20`
  - Example:
    - Job requires: `senior` (5 years)
    - Candidate has: 7 years → **+20 points** (exceeds requirement)
    - Candidate has: 3 years → `(3 / 5) * 20 = 12 points`

## Total Score Calculation

```
Match Score = Classification Match (50) + Skills Match (0-30) + Experience Match (0-20)
Final Score = Math.min(100, Math.round(total))
```

## Score Ranges & Interpretation

| Score Range | Color Code | Interpretation |
|------------|------------|----------------|
| 80-100 | 🟢 Green (Success) | Excellent match - candidate strongly aligns with job requirements |
| 60-79 | 🔵 Blue (Info) | Good match - candidate meets most requirements |
| 40-59 | 🟡 Yellow (Warning) | Moderate match - candidate partially meets requirements |
| 0-39 | 🔴 Red (Danger) | Poor match - candidate doesn't meet most requirements |

## Examples

### Example 1: Perfect Match
- **Classification**: ✅ Matches (Software Engineer)
- **Skills**: 3/3 required skills match
- **Experience**: 6 years (job requires 5)
- **Calculation**: 50 + 30 + 20 = **100 points** 🟢

### Example 2: Good Match
- **Classification**: ✅ Matches (Data Analyst)
- **Skills**: 2/4 required skills match
- **Experience**: 2 years (job requires 3)
- **Calculation**: 50 + 15 + 13.3 = **78 points** 🔵

### Example 3: Moderate Match
- **Classification**: ✅ Matches (Product Manager)
- **Skills**: 1/5 required skills match
- **Experience**: 1 year (job requires 5)
- **Calculation**: 50 + 6 + 4 = **60 points** 🟡

### Example 4: Poor Match
- **Classification**: ✅ Matches (Designer)
- **Skills**: 0/3 required skills match
- **Experience**: 0 years (job requires 3)
- **Calculation**: 50 + 0 + 0 = **50 points** 🟡

## When Matching Occurs

1. **Job Creation/Update**: When a job is created or updated with a `job_classification`, the system automatically matches all candidates with the same classification
2. **Candidate Profile Update**: When a candidate updates their `job_classification`, they are automatically matched to all relevant jobs
3. **Manual Re-match**: Users can click "Re-match" button on the Matches page to recalculate scores

## Important Notes

- **Classification is Required**: Candidates must have a matching `job_classification` to be matched at all (base 50 points)
- **Resume is Optional**: Matching works even if candidate doesn't have a resume uploaded (uses profile data)
- **Skills are Optional**: If no skills are provided, the skills component contributes 0 points
- **Experience is Optional**: If no experience is provided, the experience component contributes 0 points
- **Minimum Score**: Even with perfect classification match, minimum score is 50 (if no skills/experience data)

## Database Storage

Match scores are stored in the `job_matches` table:
- `match_score`: DECIMAL(5,2) - The calculated score (0-100)
- `matched_at`: TIMESTAMP - When the match was created/updated
- `status`: VARCHAR(50) - Match status (pending, reviewed, shortlisted, rejected)

## Viewing Match Scores

- **Candidates**: Can see their match scores on the Matches page
- **Consultants/Admins**: Can see match scores when viewing job matches, grouped by job or candidate
- **Dashboard**: Average match score is available as a KPI for candidates

