const sql = require('mssql');

const userRecentQueries = {
    isJobInRecentViews: async (jobId, userId) => {
        try {
            const result = await sql.query`
                SELECT * FROM user_recent_viewed_jobs
                WHERE user_id = ${userId} AND jobPostings_id = ${jobId}`;
            return result.recordset.length > 0;
        } catch (err) {
            console.error('Database query error:', err);
            throw err;
        }
    },

    getRecentViews: async (userId) => {
        try {
            const result = await sql.query`
                SELECT urvj.*, jp.id as job_id, jp.title, jp.description, jp.salary, jp.location, jp.postedDate, jp.applicants,
                c.name as company_name, 
                c.logo as company_logo
                FROM user_recent_viewed_jobs urvj
                JOIN companies c ON urvj.company_id = c.id
                JOIN jobPostings jp ON urvj.jobPostings_id = jp.id
                WHERE urvj.user_id = ${userId}
                ORDER BY urvj.viewed_at DESC
                OFFSET 0 ROWS
                FETCH NEXT 6 ROWS ONLY`;
            return result.recordset;
        } catch (err) {
            console.error('Database query error:', err);
            throw err;
        }
    },

    getViewedJobs: async (userId) => {
        try {
            const result = await sql.query`
                SELECT STRING_AGG(urvj.jobPostings_id, ',') AS viewed_job_ids
                FROM user_recent_viewed_jobs urvj
                WHERE urvj.user_id = ${userId}`;
            const ids = result.recordset[0]?.viewed_job_ids || '';
            return ids ? ids.split(',').map(Number) : [];
        } catch (err) {
            console.error('Database query error:', err);
            throw err;
        }
    },

    addViewedJob: async (jobId, companyId, userId) => {
        try {
            await sql.query`
            MERGE user_recent_viewed_jobs AS target
            USING (VALUES (${jobId}, ${companyId}, ${userId})) 
                AS source (jobPostings_id, company_id, user_id)
            ON target.jobPostings_id = source.jobPostings_id 
                AND target.user_id = source.user_id
            WHEN NOT MATCHED THEN
                INSERT (jobPostings_id, company_id, user_id, viewed_at)
                VALUES (source.jobPostings_id, source.company_id, source.user_id, GETDATE());
        `;
        } catch (err) {
            console.error('Database query error:', err);
            throw err;
        }
    },
}

module.exports = userRecentQueries;