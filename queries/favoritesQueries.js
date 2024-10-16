const sql = require('mssql');
const { addComment } = require('./commentQueries');
const { pool } = require('../db'); // Adjust the path as necessary


const favoritesQueries = {
  addToFavorites: async (userId, postId) => {
    try {
      const checkExistence = await pool.request().query`
                SELECT * FROM favorites 
                WHERE user_id = ${userId} AND post_id = ${postId}`;

      if (checkExistence.recordset.length > 0) {
        throw new Error('User has already favorited this post.');
      }

      // Add post to user's favorites
      await pool.request().query`
                INSERT INTO favorites (user_id, post_id, created_at)
                VALUES (${userId}, ${postId}, GETDATE())`;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getFavoriteJobByJobIdAndUserId: async (jobId, userId) => {
    try {
      const result = await pool.request().query`
                SELECT * FROM favorites_jobs
                WHERE user_id = ${userId} AND job_posting_id = ${jobId}`;

      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getFavoritePostByPostIdAndUserId: async (postId, userId) => {
    try {
      const result = await pool.request().query`
                SELECT * FROM favorites
                WHERE user_id = ${userId} AND post_id = ${postId}`;

      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  addCommentToFavorites: async (userId, postId, commentId) => {
    try {
      // Check if the post exists
      const postCheck = await pool.request().query`
        SELECT * FROM posts WHERE id = ${postId}`;

      if (postCheck.recordset.length === 0) {
        throw new Error(`Post with id ${postId} does not exist.`);
      }

      // Check if the comment exists and is related to the post
      const commentCheck = await pool.request().query`
        SELECT * FROM comments WHERE id = ${commentId} AND post_id = ${postId}`;

      if (commentCheck.recordset.length === 0) {
        throw new Error(
          `Comment with id ${commentId} does not exist or is not related to post with id ${postId}.`
        );
      }

      // Check if the comment is already favorited by the user
      const checkExistence = await pool.request().query`
        SELECT * FROM favorites_comments
        WHERE user_id = ${userId} AND post_id = ${postId} AND comment_id = ${commentId}`;

      if (checkExistence.recordset.length > 0) {
        throw new Error('User has already favorited this comment.');
      }

      // Add comment to user's favorites
      await pool.request().query`
        INSERT INTO favorites_comments (user_id, post_id, comment_id, created_at)
        VALUES (${userId}, ${postId}, ${commentId}, GETDATE())`;

      return 'Comment successfully added to favorites.';
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  addJobToFavorites: async (userId, jobId) => {
    try {
      const checkExistence = await pool.request().query`
                SELECT * FROM favorites_jobs
                WHERE user_id = ${userId} AND job_posting_id = ${jobId}`;

      if (checkExistence.recordset.length > 0) {
        throw new Error('Job is already in user\'s favorites.');
      }
      await pool.request().query`
                INSERT INTO favorites_jobs (user_id, job_posting_id, created_at)
                VALUES (${userId}, ${jobId}, GETDATE())`;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  removeJobFromFavorites: async (userId, jobId) => {
    try {
      const checkExistence = await pool.request().query`
                SELECT * FROM favorites_jobs
                WHERE user_id = ${userId} AND job_posting_id = ${jobId}`;

      if (checkExistence.recordset.length === 0) {
        throw new Error('Job is not in user\'s favorites.');
      }

      // Remove job from user's favorites
      await pool.request().query`
                DELETE FROM favorites_jobs
                WHERE user_id = ${userId} AND job_posting_id = ${jobId}`;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  removeCommentFromFavorites: async (userId, postId, commentId) => {
    try {
      // check if comment exists in user's favorites
      const checkExistence = await pool.request().query`
                SELECT * FROM favorites_comments
                WHERE user_id = ${userId} AND post_id = ${postId} AND comment_id = ${commentId}`;

      if (checkExistence.recordset.length === 0) {
        throw new Error('Comment is not in user\'s favorites.');
      }

      // Remove comment from user's favorites
      await pool.request().query`
                DELETE FROM favorites_comments
                WHERE user_id = ${userId} AND post_id = ${postId} AND comment_id = ${commentId}`;

      return 'Comment successfully removed from favorites.';
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  removeFromFavorites: async (userId, postId) => {
    try {
      // check if post exists in user's favorites
      const checkExistence = await pool.request().query`
                SELECT * FROM favorites 
                WHERE user_id = ${userId} AND post_id = ${postId}`;

      if (checkExistence.recordset.length === 0) {
        throw new Error('Post is not in user\'s favorites.');
      }

      // Remove post from user's favorites
      await pool.request().query`
                DELETE FROM favorites 
                WHERE user_id = ${userId} AND post_id = ${postId}`;

      return 'Post successfully removed from favorites.';
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getFavorites: async (userId) => {
    try {
      const result = await pool.request().query`
                SELECT f.*,
                p.title, p.content, p.user_id, p.created_at, p.updated_at,
                u.username, u.avatar 
                FROM favorites f
                INNER JOIN posts p ON f.post_id = p.id
                INNER JOIN users u ON p.user_id = u.id
                WHERE f.user_id = ${userId}`;

      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getFavoriteJobs: async (userId) => {
    try {
      const result = await pool.request().query`
        SELECT f.*, j.title, j.id as job_id, j.description, j.company_id, j.location, j.link, j.postedDate, j.salary, j.salary_max, j.experienceLevel, j.industry, j.size, j.stock_symbol, c.name as company_name, c.logo as company_logo
        FROM favorites_jobs f
        INNER JOIN dbo.JobPostings j ON f.job_posting_id = j.id
        INNER JOIN dbo.companies c ON j.company_id = c.id
        WHERE f.user_id = ${userId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getFavoritePosts: async (userId) => {
    try {
      const result = await pool.request().query`
        SELECT f.*, p.title, p.content, p.user_id, p.created_at, p.updated_at, p.communities_id, u.username, u.avatar, u.profile_border_color, c.shortname as community_name, c.community_color AS community_color, c.mini_icon AS community_icon
        FROM favorites f
        INNER JOIN posts p ON f.post_id = p.id
        INNER JOIN users u ON p.user_id = u.id
        INNER JOIN communities c ON p.communities_id = c.id
        WHERE f.user_id = ${userId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getFavoriteComments: async (userId) => {
    try {
      const result = await pool.request().query`
        SELECT f.*, c.id, c.post_id, c.parent_comment_id, c.user_id, c.comment, c.created_at, c.deleted, c.boosts, c.detracts, c.react_like, c.react_love, c.react_curious, c.react_interesting, c.react_celebrate
        FROM favorites_comments f
        INNER JOIN dbo.comments c ON f.comment_id = c.id
        WHERE f.user_id = ${userId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
};

module.exports = favoritesQueries;
