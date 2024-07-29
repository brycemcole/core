const sql = require('mssql');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 1200 }); // TTL is 20 minutes
const sharp = require('sharp');
const config = require('../config/dbConfig');

const utilFunctions = {
  uuid: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0,
          v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  },

  sharePost: async (postId) => {
    try {
      const result = await sql.query`
        UPDATE posts
        SET share_count = COALESCE(share_count, 0) + 1
        WHERE id = ${postId}
      `;
      return result.rowsAffected;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  applyJob: async (jobId) => {
    try {
      const result = await sql.query`
        UPDATE JobPostings
        SET applicants = COALESCE(applicants, 0) + 1
        WHERE id = ${jobId}
      `;
      return result.rowsAffected;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
    

  shareJob: async (jobId) => {
    try {
      const result = await sql.query`
        UPDATE JobPostings
        SET share_count = COALESCE(share_count, 0) + 1
        WHERE id = ${jobId}
      `;
      return result.rowsAffected;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getPosts: async (
    sortBy = 'trending',
    user,
    page = 1,
    limit = 10,
    offset
  ) => {
    try {
      const result = await sql.query`
      WITH CTE AS (
        SELECT 
          p.id, p.created_at, p.deleted, p.title, p.content, p.subtitle, p.link, 
          p.communities_id, p.react_like, p.react_love, p.react_curious, p.share_count,
          p.react_interesting, p.react_celebrate, p.post_type, p.views, 
          p.isGlobalPinned, u.username, u.avatar, u.isAdmin, u.verified, u.firstname, u.lastname, u.id as user_id,
          CASE WHEN ur.follower_id IS NOT NULL THEN 1 ELSE 0 END AS is_following,
          c.name AS community_name, c.community_color as community_color, c.mini_icon as community_icon,
          c.shortname AS community_shortname,
          SUM(CASE WHEN upa.action_type = 'LOVE' THEN 1 ELSE 0 END) as loveCount,
          SUM(CASE WHEN upa.action_type = 'B' THEN 1 ELSE 0 END) as boostCount,
          SUM(CASE WHEN upa.action_type = 'DISLIKE' THEN 1 ELSE 0 END) as dislikeCount,
          SUM(CASE WHEN upa.action_type = 'CURIOUS' THEN 1 ELSE 0 END) as curiousCount,
          SUM(CASE WHEN upa.action_type = 'LIKE' THEN 1 ELSE 0 END) as likeCount,
          SUM(CASE WHEN upa.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) as celebrateCount,
          je.title AS job_title,
          je.companyName AS job_company,
          ee.institutionName AS education_institution,
          ROW_NUMBER() OVER (ORDER BY p.created_at DESC) AS RowNum
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN userPostActions upa ON p.id = upa.post_id
        LEFT JOIN communities c ON p.communities_id = c.id
        LEFT JOIN user_relationships ur ON u.id = ur.followed_id AND ur.follower_id = ${user.id}
OUTER APPLY (
  SELECT TOP 1 
    title,
    CASE 
      WHEN u.settings_PrivateJobNames = 1 THEN 'Company'
      ELSE companyName 
    END AS companyName
  FROM job_experiences
  WHERE userId = u.id
  ORDER BY startDate DESC
) je
OUTER APPLY (
  SELECT TOP 1 
    CASE 
      WHEN u.settings_PrivateSchoolNames = 1 THEN 'Institution'
      ELSE institutionName 
    END AS institutionName,
    degree,
    fieldOfStudy,
    startDate,
    endDate,
    isCurrent,
    grade,
    activities,
    description
  FROM education_experiences
  WHERE userId = u.id
  ORDER BY startDate DESC
) ee
        WHERE p.deleted = 0 AND c.PrivacySetting = 'Public' AND c.id != 9
        GROUP BY 
          p.id, p.created_at, p.deleted, u.username, p.title, p.content, p.link, p.subtitle, 
          p.communities_id, u.avatar, c.name, c.shortname, c.community_color, c.mini_icon, u.isAdmin, u.verified, u.firstname, u.lastname,
          p.react_like, p.react_love, p.react_curious, p.react_interesting, u.id, p.share_count,
          p.react_celebrate, p.post_type, p.views, p.isGlobalPinned, ur.follower_id,
          je.title, je.companyName, ee.institutionName
      )
      SELECT *, 
        (SELECT TOP 1 upa2.action_type 
         FROM userPostActions upa2
         WHERE upa2.post_id = CTE.id AND upa2.user_id = ${user.id}) as userReaction,
        (SELECT STRING_AGG(tags.name, ', ') 
         FROM post_tags 
         INNER JOIN tags ON post_tags.tag_id = tags.id
         WHERE post_tags.post_id = CTE.id) AS post_tags,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = CTE.id) AS comment_count
      FROM CTE
      WHERE RowNum > ${offset} AND RowNum <= ${offset + limit}
      ORDER BY created_at DESC
    `;

    if (user.settings_PrivateJobNames === 1) {
      result.recordset.forEach((post) => {
        post.job_title = post.job_title || 'Job Title';
        post.job_company = post.job_company || 'Company';
      });
    }


      const countResult = await sql.query`
        SELECT COUNT(*) AS totalCount
        FROM posts p
        WHERE p.deleted = 0
      `;

      const totalCount = countResult.recordset[0].totalCount;
      const totalPages = Math.ceil(totalCount / limit);

      let sortedResult = result.recordset;

      const prioritizePinned = ['trending', 'explore'].includes(sortBy);

      sortedResult.sort((a, b) => {
        if (prioritizePinned && a.isGlobalPinned !== b.isGlobalPinned) {
          return b.isGlobalPinned ? 1 : -1;
        }

        const now = new Date();
        switch (sortBy) {
        case 'trending':
          const minutesA = (now - new Date(a.created_at)) / (1000 * 60);
          const minutesB = (now - new Date(b.created_at)) / (1000 * 60);
          const reactionsA =
              a.loveCount * 5 +
              a.boostCount * 4 +
              a.dislikeCount * 3 +
              a.curiousCount * 2 +
              a.likeCount +
              a.celebrateCount * 3;
          const reactionsB =
              b.loveCount * 5 +
              b.boostCount * 4 +
              b.dislikeCount * 3 +
              b.curiousCount * 2 +
              b.likeCount +
              b.celebrateCount * 3;
          const reactionsPerMinuteA = reactionsA / (minutesA + 1);
          const reactionsPerMinuteB = reactionsB / (minutesB + 1);
          const followingWeightA = a.is_following ? 1.2 : 1;
          const followingWeightB = b.is_following ? 1.2 : 1;
          const recentWeightA = Math.exp(-minutesA / (6 * 60));
          const recentWeightB = Math.exp(-minutesB / (6 * 60));
          return (
            reactionsPerMinuteB * followingWeightB * recentWeightB -
              reactionsPerMinuteA * followingWeightA * recentWeightA
          );
        case 'top':
          const totalReactionsA =
              a.loveCount +
              a.boostCount +
              a.dislikeCount +
              a.curiousCount +
              a.likeCount +
              a.celebrateCount;
          const totalReactionsB =
              b.loveCount +
              b.boostCount +
              b.dislikeCount +
              b.curiousCount +
              b.likeCount +
              b.celebrateCount;
          return totalReactionsB - totalReactionsA;
        case 'new':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'explore':
          const totalReactionsExploreA =
              a.loveCount +
              a.boostCount +
              a.dislikeCount +
              a.curiousCount +
              a.likeCount +
              a.celebrateCount;
          const totalReactionsExploreB =
              b.loveCount +
              b.boostCount +
              b.dislikeCount +
              b.curiousCount +
              b.likeCount +
              b.celebrateCount;
          const viewsWeightA = Math.log(a.views + 1);
          const viewsWeightB = Math.log(b.views + 1);
          const diversityWeightA = 1 / (a.is_following ? 2 : 1);
          const diversityWeightB = 1 / (b.is_following ? 2 : 1);
          return (
            totalReactionsExploreB * viewsWeightB * diversityWeightB -
              totalReactionsExploreA * viewsWeightA * diversityWeightA
          );
        default:
          return new Date(b.created_at) - new Date(a.created_at);
        }
      });

      return {
        posts: sortedResult,
        currentPage: page,
        totalPages: totalPages,
      };
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getTagById: async (tagId) => {
    try {
      const result = await sql.query`
        SELECT * FROM tags WHERE id = ${tagId}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCommunityName: async (communityId, getFullName) => {
    try {
      if (getFullName) {
        const result = await sql.query`
        SELECT name FROM communities WHERE id = ${communityId}
      `;
        return result.recordset[0].name;
      }
      const result = await sql.query`
        SELECT shortname FROM communities WHERE id = ${communityId}
      `;
      return result.recordset[0].shortname;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getDominantColor: async (imageUrl) => {
    try {
      const cacheKey = `dominantColor:${imageUrl}`;
      const cachedColor = cache.get(cacheKey);
      if (cachedColor) {
        return cachedColor;
      }

      function rgbToHex(rgb) {
        let hex = Number(rgb).toString(16);
        if (hex.length < 2) {
          hex = '0' + hex;
        }
        return hex;
      }

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });
      const buffer = Buffer.from(response.data, 'binary');
      const { data, info } = await sharp(buffer).resize(1, 1).raw().toBuffer({
        resolveWithObject: true,
      });

      const color = {
        r: data[0],
        g: data[1],
        b: data[2],
      };

      const hexColor = `#${rgbToHex(color.r)}${rgbToHex(color.g)}${rgbToHex(
        color.b
      )}`;
      cache.set(cacheKey, hexColor);
      return hexColor;
    } catch (error) {
      console.error('Error getting dominant color:', error);
      return '#000000';
    }
  },

  getAllTags: async () => {
    try {
      const result = await sql.query`
        SELECT * FROM tags
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getPostsForCommunity: async (
    communityID,
    sortBy = 'trending',
    userId,
    page = 1,
    limit = 10,
    offset
  ) => {
    try {
      const result = await sql.query`
        SELECT p.id, p.created_at, p.deleted, p.title, p.content, p.subtitle, p.link, p.communities_id, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate, p.post_type, p.views, u.username, u.avatar, p.share_count,
        c.name AS community_name, c.shortname AS community_shortname, c.community_color AS community_color,
              SUM(CASE WHEN upa.action_type = 'LOVE' THEN 1 ELSE 0 END) as loveCount,
              SUM(CASE WHEN upa.action_type = 'B' THEN 1 ELSE 0 END) as boostCount,
              SUM(CASE WHEN upa.action_type = 'DISLIKE' THEN 1 ELSE 0 END) as dislikeCount,
              SUM(CASE WHEN upa.action_type = 'CURIOUS' THEN 1 ELSE 0 END) as curiousCount,
              SUM(CASE WHEN upa.action_type = 'LIKE' THEN 1 ELSE 0 END) as likeCount,
              SUM(CASE WHEN upa.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) as celebrateCount,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN userPostActions upa ON p.id = upa.post_id
        LEFT JOIN communities c ON p.communities_id = c.id
        WHERE p.communities_id = ${communityID} AND p.deleted = 0
        GROUP BY p.id, p.created_at, p.share_count, p.deleted, u.username, p.title, p.content, p.subtitle, p.link, p.communities_id, u.avatar, p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate, p.post_type, p.views, c.name, c.shortname, c.community_color
        ORDER BY p.created_at DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `;
      const countResult = await sql.query`
      SELECT COUNT(*) AS totalCount
      FROM posts p
      WHERE p.deleted = 0 AND p.communities_id = ${communityID}
      `;

      const totalCount = countResult.recordset[0].totalCount;
      const totalPages = Math.ceil(totalCount / limit);

      let sortedResult;

      switch (sortBy) {
      case 'trending':
        const now = new Date();
        sortedResult = result.recordset.sort((a, b) => {
          const minutesA = (now - new Date(a.created_at)) / (1000 * 60);
          const minutesB = (now - new Date(b.created_at)) / (1000 * 60);
          const reactionsA =
              a.loveCount * 5 +
              a.boostCount * 4 +
              a.dislikeCount * 3 +
              a.curiousCount * 2 +
              a.likeCount +
              a.celebrateCount * 3;
          const reactionsB =
              b.loveCount * 5 +
              b.boostCount * 4 +
              b.dislikeCount * 3 +
              b.curiousCount * 2 +
              b.likeCount +
              b.celebrateCount * 3;
          const reactionsPerMinuteA = reactionsA / (minutesA + 1);
          const reactionsPerMinuteB = reactionsB / (minutesB + 1);
          const followingWeightA = a.is_following ? 1.2 : 1;
          const followingWeightB = b.is_following ? 1.2 : 1;
          const ageWeightA = Math.exp(-minutesA / (24 * 60)); // Exponential decay based on age
          const ageWeightB = Math.exp(-minutesB / (24 * 60));
          return (
            reactionsPerMinuteB * followingWeightB * ageWeightB -
              reactionsPerMinuteA * followingWeightA * ageWeightA
          );
        });
        break;

      case 'top':
        sortedResult = result.recordset.sort((a, b) => {
          const totalReactionsA =
              a.loveCount +
              a.boostCount +
              a.dislikeCount +
              a.curiousCount +
              a.likeCount +
              a.celebrateCount;
          const totalReactionsB =
              b.loveCount +
              b.boostCount +
              b.dislikeCount +
              b.curiousCount +
              b.likeCount +
              b.celebrateCount;
          return totalReactionsB - totalReactionsA;
        });
        break;
      case 'new':
        sortedResult = result.recordset.sort((a, b) => {
          const dateA = new Date(a.created_at);
          const dateB = new Date(b.created_at);
          return dateB - dateA;
        });
        break;

      case 'explore':
        sortedResult = result.recordset.sort((a, b) => {
          const totalReactionsA =
              a.loveCount +
              a.boostCount +
              a.dislikeCount +
              a.curiousCount +
              a.likeCount +
              a.celebrateCount;
          const totalReactionsB =
              b.loveCount +
              b.boostCount +
              b.dislikeCount +
              b.curiousCount +
              b.likeCount +
              b.celebrateCount;
          const viewsWeightA = Math.log(a.views + 1); // Log scale for views
          const viewsWeightB = Math.log(b.views + 1);
          const diversityWeightA = 1 / (a.is_following ? 2 : 1); // Penalize posts from followed users
          const diversityWeightB = 1 / (b.is_following ? 2 : 1);
          return (
            totalReactionsB * viewsWeightB * diversityWeightB -
              totalReactionsA * viewsWeightA * diversityWeightA
          );
        });
        break;

      default:
        sortedResult = result.recordset.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
      }

      return {
        posts: sortedResult,
        currentPage: page,
        totalPages: totalPages,
      };
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getAllCommunities: async () => {
    try {
      const result = await sql.query`
        SELECT name FROM communities`;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getTrendingPosts: async () => {
    try {
      const result = await sql.query`
      SELECT TOP 7 *
      FROM (
          SELECT p.id, p.created_at, p.deleted, p.title, p.content, p.subtitle, p.link, p.communities_id,
                 p.react_like, p.react_love, p.react_curious, p.react_interesting, p.react_celebrate, p.views, u.username, u.avatar,
                 SUM(CASE WHEN upa.action_type = 'LOVE' THEN 1 ELSE 0 END) as loveCount,
                 SUM(CASE WHEN upa.action_type = 'B' THEN 1 ELSE 0 END) as boostCount,
                 SUM(CASE WHEN upa.action_type = 'DISLIKE' THEN 1 ELSE 0 END) as dislikeCount,
                 SUM(CASE WHEN upa.action_type = 'CURIOUS' THEN 1 ELSE 0 END) as curiousCount,
                 SUM(CASE WHEN upa.action_type = 'LIKE' THEN 1 ELSE 0 END) as likeCount,
                 SUM(CASE WHEN upa.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) as celebrateCount,
                 DATEDIFF(MINUTE, p.created_at, GETDATE()) as minutesElapsed,
                 (SELECT shortname FROM communities WHERE id = p.communities_id) AS community_name,
                 (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
          FROM posts p
          INNER JOIN users u ON p.user_id = u.id
          LEFT JOIN userPostActions upa ON p.id = upa.post_id
          WHERE p.deleted = 0 AND communities_id != 9
          GROUP BY p.id, p.created_at, p.deleted,  p.title, p.content, p.subtitle, p.link, p.communities_id,
                   u.username, u.avatar, p.react_like, p.react_love, p.react_curious,
                   p.react_interesting, p.react_celebrate, p.views
      ) AS SubQuery
      ORDER BY ((loveCount * 5 + boostCount * 3 + dislikeCount * 3 + curiousCount * 1 + likeCount * 1 + celebrateCount * 3) * 100 + views) / POWER(minutesElapsed / 60 + 1, 1.1) DESC;
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  
  getComments: async (postId) => {
    const query = `
      WITH CommentCTE AS (
        SELECT 
          c.id, c.created_at, c.deleted, c.comment, c.user_id, c.parent_comment_id, c.post_id, c.isPinned,
          u.username, u.avatar,
          SUM(CASE WHEN uca.action_type = 'LOVE' THEN 1 ELSE 0 END) AS loveCount,
          SUM(CASE WHEN uca.action_type = 'B' THEN 1 ELSE 0 END) AS boostCount,
          SUM(CASE WHEN uca.action_type = 'CURIOUS' THEN 1 ELSE 0 END) AS curiousCount,
          SUM(CASE WHEN uca.action_type = 'LIKE' THEN 1 ELSE 0 END) AS likeCount,
          SUM(CASE WHEN uca.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) AS celebrateCount
        FROM comments c
        LEFT JOIN UserCommentActions uca ON c.id = uca.comment_id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.post_id = @postId AND c.deleted = 0
        GROUP BY c.id, c.created_at, c.deleted, c.comment, c.user_id, c.parent_comment_id, c.post_id, c.isPinned,
                 u.username, u.avatar
      )
      SELECT 
        c1.*,
        c2.id AS reply_id,
        c2.comment AS reply_comment,
        c2.user_id AS reply_user_id,
        c2.created_at AS reply_created_at,
        c2.username AS reply_username,
        c2.avatar AS reply_avatar
      FROM CommentCTE c1
      LEFT JOIN CommentCTE c2 ON c1.id = c2.parent_comment_id
      ORDER BY c1.created_at DESC, c2.created_at ASC;
    `;
  
    const result = await sql.query(query, { postId });
  
    const commentMap = new Map();
    const rootComments = [];
  
    result.recordset.forEach(row => {
      if (!commentMap.has(row.id)) {
        const comment = {
          id: row.id,
          created_at: row.created_at,
          comment: row.comment,
          user: { id: row.user_id, username: row.username, avatar: row.avatar },
          isPinned: row.isPinned,
          reactions: {
            loveCount: row.loveCount,
            boostCount: row.boostCount,
            curiousCount: row.curiousCount,
            likeCount: row.likeCount,
            celebrateCount: row.celebrateCount
          },
          replies: []
        };
        commentMap.set(row.id, comment);
  
        if (row.parent_comment_id) {
          const parentComment = commentMap.get(row.parent_comment_id);
          if (parentComment) {
            parentComment.replies.push(comment);
          }
        } else {
          rootComments.push(comment);
        }
      }
  
      if (row.reply_id && !commentMap.has(row.reply_id)) {
        const reply = {
          id: row.reply_id,
          created_at: row.reply_created_at,
          comment: row.reply_comment,
          user: { id: row.reply_user_id, username: row.reply_username, avatar: row.reply_avatar },
          replies: []
        };
        commentMap.set(row.reply_id, reply);
        commentMap.get(row.id).replies.push(reply);
      }
    });
  
    return rootComments;
  },

  getPostData: async (postId, user) => {
    try {
      let userId;
      if (user) {
        userId = user.id;
      } else {
        userId = null;
      }

      const result = await sql.query`
        SELECT 
          p.id, p.created_at, p.deleted, p.title, p.content, p.subtitle, p.link, p.communities_id, p.share_count,
          p.link_description, p.link_image, p.link_title, p.react_like, p.react_love, 
          p.react_curious, p.react_interesting, p.react_celebrate, p.post_type, p.updated_at, p.isLocked,
          p.views, u.username, u.id as user_id, u.avatar,
          ISNULL(u2.username, 'unknown') AS user_username,
          ISNULL(u2.avatar, null) AS user_avatar,
          SUM(CASE WHEN upa.action_type = 'LOVE' THEN 1 ELSE 0 END) as loveCount,
          SUM(CASE WHEN upa.action_type = 'B' THEN 1 ELSE 0 END) as boostCount,
          SUM(CASE WHEN upa.action_type = 'DISLIKE' THEN 1 ELSE 0 END) as dislikeCount,
          SUM(CASE WHEN upa.action_type = 'CURIOUS' THEN 1 ELSE 0 END) as curiousCount,
          SUM(CASE WHEN upa.action_type = 'LIKE' THEN 1 ELSE 0 END) as likeCount,
          SUM(CASE WHEN upa.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) as celebrateCount,
          upa2.action_type as userReaction
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN userPostActions upa ON p.id = upa.post_id
        LEFT JOIN users u2 ON u.id = u2.id
        LEFT JOIN userPostActions upa2 ON p.id = upa2.post_id AND upa2.user_id = ${userId}
        WHERE p.id = ${postId}
        GROUP BY 
          p.id, p.created_at, p.deleted, u.username, p.title, p.content, p.subtitle, p.link, p.communities_id,
          p.link_description, p.link_image, p.link_title, p.react_like, p.react_love, p.react_curious,
          p.react_interesting, p.react_celebrate, u.avatar, u.id, p.post_type, p.updated_at, p.isLocked, p.share_count,
          p.views, u2.username, u2.avatar, upa2.action_type
      `;

      const postData = result.recordset[0];
      return postData;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getAllCommunities: async (user) => {
    try {
      let query = sql.query`
      SELECT 
        c.id, 
        c.name, 
        c.mini_icon, 
        c.community_color,
        c.shortname, 
        CASE WHEN cm.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_member,
        (SELECT COUNT(*) FROM community_memberships WHERE community_id = c.id) AS MemberCount
      FROM 
        communities c
      LEFT JOIN 
        community_memberships cm 
      ON 
        c.id = cm.community_id 
        AND cm.user_id = ${user ? user.id : null}
      WHERE 
        c.PrivacySetting = 'Public'
      AND 
        c.id != 9
      ORDER BY 
        MemberCount DESC
    `;

      const result = await query;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCommunities: async (communityId) => {
    try {
      const result = await sql.query`
        SELECT * FROM communities WHERE id = ${communityId}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getRepliesForComment: async (commentId) => {
    try {
      const result = await sql.query`
        SELECT * FROM comments WHERE parent_comment_id = ${commentId}
      `;
      const commentList = result.recordset;
      return await utilFunctions.getNestedComments(commentList);
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  getComments: async (postId) => {
    try {
      const result = await sql.query`
        SELECT c.*, u.username, u.avatar, u.isAdmin
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ${postId} AND c.deleted = 0
      `;
      const commentList = result.recordset;
      const totalComments = commentList.length;

      const nestedComments = utilFunctions.getNestedComments(commentList);

      return { comments: nestedComments, totalComments };
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getNestedComments: (commentList) => {
    const commentMap = {};

    // First pass: create comment objects and populate the map
    commentList.forEach((comment) => {
      commentMap[comment.id] = {
        ...comment,
        user: {
          id: comment.user_id,
          username: comment.username,
          avatar: comment.avatar,
          isAdmin: comment.isAdmin
        },
        replies: []
      };
      // Remove redundant properties
      delete commentMap[comment.id].username;
      delete commentMap[comment.id].avatar;
      delete commentMap[comment.id].isAdmin;
    });

    // Second pass: build the nested structure
    const nestedComments = [];
    commentList.forEach((comment) => {
      if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
        commentMap[comment.parent_comment_id].replies.push(commentMap[comment.id]);
      } else {
        nestedComments.push(commentMap[comment.id]);
      }
    });

    return nestedComments;
  },
  getTags: async (postId) => {
    try {
      const result = await sql.query`
        SELECT t.* FROM tags t
        INNER JOIN post_tags pt ON t.id = pt.tag_id
        WHERE pt.post_id = ${postId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getUserDetails: async (userId) => {
    try {
      const userResult =
        await sql.query`SELECT * FROM users WHERE id = ${userId}`;
      if (userResult.recordset.length > 0) {
        return userResult.recordset[0];
      } else {
        // Return a default user object instead of throwing an error
        return { id: userId, username: 'unknown', avatar: null };
      }
    } catch (err) {
      console.error('Database query error:', err);
      // Optionally, you can still return a default user object in case of query error
      return { id: userId, username: 'error', avatar: null };
    }
  },

  getUserDetailsFromGithub: async (githubUsername) => {
    try {
      const query = `SELECT * FROM users WHERE github_url = '${githubUsername}'`;
      const result = await sql.query(query);

      if (result.recordset.length > 0) {
        return result.recordset[0];
      } else {
        return null;
      }
    } catch (err) {
      console.error('Database query error:', err);
      return null;
    }
  },

  checkForDuplicates: async (jobDetails) => {
    try {
      const {
        title,
        company_id,
        location,
        description,
        salary,
        salary_max,
        experienceLevel,
      } = jobDetails;

      const potentialDuplicates = await sql.query`
        SELECT id, title, location, description, salary, salary_max, experienceLevel
        FROM JobPostings
        WHERE company_id = ${company_id}
          AND DATEDIFF(day, postedDate, GETDATE()) <= 30  -- Check only recent postings (last 30 days)
      `;

      for (const existingJob of potentialDuplicates.recordset) {
        let similarityScore = 0;

        // Check title similarity (3 points)
        if (title.toLowerCase() === existingJob.title.toLowerCase()) {
          similarityScore += 3;
        } else if (
          title.toLowerCase().includes(existingJob.title.toLowerCase()) ||
          existingJob.title.toLowerCase().includes(title.toLowerCase())
        ) {
          similarityScore += 2;
        }

        // Check location (2 points)
        if (location.toLowerCase() === existingJob.location.toLowerCase()) {
          similarityScore += 2;
        }

        // Check salary range overlap (2 points)
        const salaryOverlap =
          (salary <= existingJob.salary_max && salary >= existingJob.salary) ||
          (salary_max >= existingJob.salary &&
            salary_max <= existingJob.salary_max);
        if (salaryOverlap) {
          similarityScore += 2;
        }

        // Check experience level (1 point)
        if (experienceLevel === existingJob.experienceLevel) {
          similarityScore += 1;
        }

        // Check description similarity (2 points)
        const descriptionSimilarity = utilFunctions.stringSimilarity(
          description,
          existingJob.description
        );
        if (descriptionSimilarity > 0.8) {
          // 80% similarity threshold
          similarityScore += 2;
        }

        // If the similarity score is high enough, consider it a duplicate
        if (similarityScore >= 7) {
          // Threshold for considering as duplicate
          console.log(
            `Potential duplicate detected. Similarity score: ${similarityScore}`
          );
          console.log(`Existing job ID: ${existingJob.id}`);
          return true;
        }
      }

      return false; // No duplicates found
    } catch (err) {
      console.error(`Error checking for duplicates: ${err.message}`);
      throw err;
    }
  },

  // Helper function to calculate string similarity (you can use a library like 'string-similarity' for better results)
  stringSimilarity: async (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const longerLength = longer.length;
    if (longerLength === 0) {
      return 1.0;
    }
    return (
      (longerLength - utilFunctions.editDistance(longer, shorter)) /
      parseFloat(longerLength)
    );
  },

  editDistance: async (s1, s2) => {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i == 0) costs[j] = j;
        else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) != s2.charAt(j - 1))
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  },

  linkify: (text) => {
    const urlRegex =
      /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
    return text.replace(urlRegex, (url) => {
      return `<a href="
        ${url}" target="_blank" class="comment-url">${url}</a>`;
    });
  },

  checkMissingFields: async (userId) => {
    let missingFields = [];

    const result = await sql.query`
      SELECT firstname, lastname FROM users WHERE id = ${userId}
    `;

    try {
      if (result.recordset.length > 0) {
        let user = result.recordset[0];
        if (!user.firstname) missingFields.push('firstname');
        if (!user.lastname) missingFields.push('lastname');
      }
      return missingFields;
    } catch (err) {
      console.error('Error in checking missing fields:', err);
    }
  },

  getLinkPreview: async (url) => {
    const getMetaTag = ($, name) => {
      return (
        $(`meta[name="${name}"]`).attr('content') ||
        $(`meta[name="twitter:${name}"]`).attr('content') ||
        $(`meta[property="og:${name}"]`).attr('content')
      );
    };

    const getFavicon = ($, baseUrl) => {
      let favicon =
        $('link[rel="shortcut icon"]').attr('href') ||
        $('link[rel="icon"]').attr('href') ||
        $('link[rel="alternate icon"]').attr('href');

      if (favicon && !favicon.startsWith('http')) {
        const urlObject = new URL(baseUrl);
        favicon = urlObject.protocol + '//' + urlObject.host + favicon;
      }

      return favicon || '';
    };

    const fetchYouTubeData = async (videoId) => {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const faviconUrl = '/src/youtubelogo.png'; // Replace with your actual favicon URL
      const API_KEY = process.env.YOUTUBE_API_KEY;
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${API_KEY}&part=snippet`;

      try {
        const response = await axios.get(apiUrl);
        if (response.data.items && response.data.items.length > 0) {
          const videoData = response.data.items[0].snippet;
          return {
            title: videoData.title,
            description: videoData.description,
            image: thumbnailUrl,
            favicon: faviconUrl,
          };
        }
      } catch (error) {
        console.error('Error fetching YouTube API data:', error.message);
      }

      return {
        title: '',
        description: '',
        image: thumbnailUrl,
        favicon: faviconUrl,
      };
    };

    const fetchRedditData = async (url) => {
      try {
        if (url.includes('/r/')) {
          // Handle subreddit URLs
          const response = await axios.get(`${url}/about.json`);
          if (response.data && response.data.data) {
            const subredditData = response.data.data;
            return {
              title: subredditData.title,
              description: subredditData.public_description,
              image:
                subredditData.icon_img || subredditData.community_icon || '',
              author: subredditData.display_name_prefixed,
              favicon: '/src/redditlogo.png',
            };
          }
        } else {
          // Handle individual post URLs
          const response = await axios.get(`${url}.json`);
          if (response.data && response.data.length > 0) {
            const postData = response.data[0].data.children[0].data;
            return {
              title: postData.title,
              description: postData.selftext || postData.title,
              image: postData.thumbnail.startsWith('http')
                ? postData.thumbnail
                : '',
              author: postData.author,
              favicon: '/src/redditlogo.png',
            };
          }
        }
      } catch (error) {
        console.error('Error fetching Reddit JSON data:', error.message);
      }

      return null;
    };

    try {
      if (typeof url !== 'string') {
        throw new Error('URL must be a string');
      }

      // Check if the URL exists in the LinkPreviewData table
      const linkPreviewDataQuery = `SELECT * FROM LinkPreviewData WHERE link = '${url}'`;
      const linkPreviewDataResult = await sql.query(linkPreviewDataQuery);
      if (linkPreviewDataResult.recordset.length > 0) {
        const linkPreviewData = linkPreviewDataResult.recordset[0];
        return {
          url: linkPreviewData.link,
          image: linkPreviewData.image_url,
          description: linkPreviewData.description,
          title: linkPreviewData.title,
          favicon: linkPreviewData.favicon,
        };
      }

      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoIdMatch = url.match(
          /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        if (videoIdMatch) {
          const videoId = videoIdMatch[1];
          const youtubeData = await fetchYouTubeData(videoId);

          // Clean up description and title
          youtubeData.description = youtubeData.description
            .replace(/\n/g, ' ')
            .trim();
          youtubeData.title = youtubeData.title.replace(/\n/g, ' ').trim();

          // Escape single quotes in description and title
          const escapedDescription = youtubeData.description.replace(
            /'/g,
            '\'\''
          );
          const escapedTitle = youtubeData.title.replace(/'/g, '\'\'');

          const preview = {
            url,
            ...youtubeData,
            description: escapedDescription,
            title: escapedTitle,
          };

          // console.log(preview);

          const insertLinkPreviewDataQuery = `
            INSERT INTO LinkPreviewData (link, image_url, description, title, favicon)
            VALUES ('${preview.url}', '${preview.image}', '${preview.description}', '${preview.title}', '${preview.favicon}')
          `;
          await sql.query(insertLinkPreviewDataQuery);

          // console.log(preview);
          return preview;
        }
      } else if (url.includes('reddit.com')) {
        const redditData = await fetchRedditData(url);
        if (redditData) {
          return {
            url,
            ...redditData,
          };
        }
      }

      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
      };

      const response = await axios.get(url, { headers, timeout: 5000 });
      const { data, status } = response;
      if (status === 200) {
        const $ = cheerio.load(data);
        const metaTags = {
          title: getMetaTag($, 'title') || $('title').text(),
          description: getMetaTag($, 'description'),
          image: getMetaTag($, 'image'),
          author: getMetaTag($, 'author'),
        };

        const preview = {
          url,
          title: metaTags.title || $('title').first().text() || url,
          favicon: getFavicon($, url),
          description: metaTags.description || '',
          image: metaTags.image || '',
          author: metaTags.author || '',
        };

        // Insert into LinkPreviewData table
        const insertLinkPreviewDataQuery = `
          INSERT INTO LinkPreviewData (link, image_url, description, title, favicon)
          VALUES ('${preview.url}', '${preview.image}', '${preview.description}', '${preview.title}', '${preview.favicon}')
        `;
        await sql.query(insertLinkPreviewDataQuery);

        return preview;
      }
    } catch (error) {
      console.error('Error fetching URL:', url);
      console.error(error);
    }

    // Return a blank object with the title set to the URL in case of an error
    return {
      url,
      title: url,
      favicon: '',
      description: '',
      image: '',
      author: '',
    };
  },

  fetchRedditData: async (url) => {
    try {
      const response = await axios.get(`${url}.json`);
      if (response.data && response.data.length > 0) {
        const postData = response.data[0].data.children[0].data;
        return {
          title: postData.title,
          description: postData.selftext || postData.title,
          image: postData.thumbnail.startsWith('http')
            ? postData.thumbnail
            : '',
          author: postData.author,
          favicon:
            'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png',
        };
      }
    } catch (error) {
      console.error('Error fetching Reddit JSON data:', error.message);
    }

    return null;
  },

  getGitHubCommitGraph: async (username) => {
    try {
      const url = `https://github.com/${username}`;

      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
      };

      const response = await axios.get(url, { headers, timeout: 5000 });
      const { data, status } = response;

      if (status !== 200) {
        throw new Error(`Request failed with status code ${status}`);
      }

      const $ = cheerio.load(data);

      const commitGraph = [];

      $('svg.js-calendar-graph-svg rect').each((index, element) => {
        const date = $(element).attr('data-date');
        const count = parseInt($(element).attr('data-count'), 10);
        const level = $(element).attr('data-level');

        commitGraph.push({ date, count, level });
      });

      return commitGraph;
    } catch (error) {
      console.error('Error fetching GitHub commit graph:', error);
      return null;
    }
  },

  getFavicon: async (url) => {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      const { data, status } = response;

      if (status !== 200) {
        throw new Error(`Request failed with status code ${status}`);
      }

      const $ = cheerio.load(data);
      let favicon =
        $('link[rel="shortcut icon"]').attr('href') ||
        $('link[rel="icon"]').attr('href') ||
        $('link[rel="alternate icon"]').attr('href');

      console.log(favicon);

      if (favicon) {
        // If favicon is a relative path, convert it to an absolute URL
        if (!favicon.startsWith('http')) {
          const urlObject = new URL(url);
          favicon = urlObject.protocol + '//' + urlObject.host + favicon;
        }
      }
    } catch (error) {
      console.warn('Error fetching favicon for URL:', url);
      console.error(error);
      return null;
    }
  },

  upsertGitHubData: async (userData, reposData) => {
    const pool = new sql.ConnectionPool(config); // Ensure 'config' is your SQL Server configuration
    await pool.connect();

    try {
      const transaction = pool.transaction();
      await transaction.begin();

      let request = transaction.request(); // Use the request from the transaction

      // Upsert user data
      let userUpsertQuery = `
        MERGE INTO GitHubUserData AS target
        USING (SELECT ${userData.id} AS id) AS source
        ON (target.id = source.id)
        WHEN MATCHED THEN
          UPDATE SET 
            username = '${userData.username.replace(/'/g, '\'\'')}', 
            user_url = '${userData.user_url.replace(/'/g, '\'\'')}', 
            avatar_url = '${userData.avatar_url.replace(/'/g, '\'\'')}', 
            time_fetched = GETDATE(), 
            raw_json = '${JSON.stringify(userData).replace(/'/g, '\'\'')}'
        WHEN NOT MATCHED THEN
          INSERT (id, username, user_url, avatar_url, time_fetched, raw_json)
          VALUES (${userData.id}, '${userData.username.replace(
  /'/g,
  '\'\''
)}', '${userData.user_url.replace(
  /'/g,
  '\'\''
)}', '${userData.avatar_url.replace(
  /'/g,
  '\'\''
)}', GETDATE(), '${JSON.stringify(userData).replace(/'/g, '\'\'')}');
      `;
      await request.query(userUpsertQuery);

      // Upsert repos data
      for (const repo of reposData) {
        let repoUpsertQuery = `
          MERGE INTO GitHubUserRepos AS target
          USING (SELECT ${repo.id} AS repo_id) AS source
          ON (target.repo_id = source.repo_id)
          WHEN MATCHED THEN
            UPDATE SET 
              user_id = ${userData.id},
              repo_name = '${repo.name.replace(/'/g, '\'\'')}',
              repo_url = '${repo.html_url.replace(/'/g, '\'\'')}',
              description = '${(repo.description || '').replace(/'/g, '\'\'')}',
              stars = ${repo.stargazers_count},
              time_fetched = GETDATE(),
              raw_json = '${JSON.stringify(repo).replace(/'/g, '\'\'')}'
          WHEN NOT MATCHED THEN
            INSERT (repo_id, user_id, repo_name, repo_url, description, stars, time_fetched, raw_json)
            VALUES (${repo.id}, ${userData.id}, '${repo.name.replace(
  /'/g,
  '\'\''
)}', '${repo.html_url.replace(/'/g, '\'\'')}', '${(
  repo.description || ''
).replace(/'/g, '\'\'')}', ${
  repo.stargazers_count
}, GETDATE(), '${JSON.stringify(repo).replace(/'/g, '\'\'')}');
        `;
        await request.query(repoUpsertQuery);
      }

      // Commit transaction
      await transaction.commit();
    } catch (error) {
      console.error('Error updating GitHub data:', error);
      if (pool.connected) {
        await pool.close();
      }
      throw error; // Rethrow the error for further handling
    }

    if (pool.connected) {
      await pool.close();
    }
  },

  getGitHubUserReposPreview: async (url) => {
    const isGitHubUserUrl = /^https?:\/\/github\.com\/[^\/]+\/?$/.test(url);
    if (!isGitHubUserUrl) {
      throw new Error('URL must be a GitHub user profile URL');
    }

    const [, username] = url.match(/github\.com\/([^\/]+)/);

    try {
      const userApiUrl = `https://api.github.com/users/${username}`;
      const reposApiUrl = `${userApiUrl}/repos`;

      const [userResponse, reposResponse] = await Promise.all([
        axios.get(userApiUrl, {
          headers: { 'User-Agent': 'request' },
          timeout: 5000,
        }),
        axios.get(reposApiUrl, {
          headers: { 'User-Agent': 'request' },
          params: { per_page: 5 },
          timeout: 5000,
        }),
      ]);

      if (userResponse.status !== 200 || reposResponse.status !== 200) {
        throw new Error(
          `Request to GitHub API failed with status: ${userResponse.status} or ${reposResponse.status}`
        );
      }

      const userData = userResponse.data;
      const reposData = reposResponse.data;

      // Convert data to JSON strings for storing
      const rawUserJson = JSON.stringify(userData);
      const rawReposJson = JSON.stringify(reposData);

      // Here you would insert/update the data into your database as required.
      // For example, you could update an existing user record with new repo data,
      // or insert a new record if one doesn't exist.
      // This part is omitted for brevity and should be implemented according to your application's needs.

      return {
        username: userData.login,
        user_url: userData.html_url,
        avatar_url: userData.avatar_url,
        repos: reposData.map((repo) => ({
          id: repo.id,
          repo_url: repo.html_url,
          repo_name: repo.name,
          description: repo.description,
          stars: repo.stargazers_count,
        })),
        time_fetched: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching GitHub user and repository data:', error);
      throw error; // Re-throw the error for handling in the calling code
    }
  },

  getGitHubRepoPreview: async (url) => {
    const isGitHubUrl = /^https?:\/\/github\.com\/.+\/.+/.test(url);
    if (!isGitHubUrl) {
      return { link: url }; // Return early if the URL is not a GitHub repository URL
    }
  
    // Extract the repository's owner and name from the URL
    const [, owner, repo] = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  
    try {
      const { Octokit } = await import('@octokit/rest');

      // Check if recent data (within the last 30 minutes) already exists in the GitHubRepoData table
      const existingDataQuery = `
        SELECT *, DATEDIFF(minute, time_fetched, GETDATE()) AS time_diff
        FROM GitHubRepoData
        WHERE repo_url = '${url}'
      `;
      const existingDataResult = await sql.query(existingDataQuery);
  
      let repoData, commitsData;
  
      // Initialize Octokit with authentication if needed
      const octokit = new Octokit({ userAgent: 'CORE' });
  
      // Check if data needs to be fetched or updated
      if (
        existingDataResult.recordset.length === 0 ||
        existingDataResult.recordset[0].time_diff > 30
      ) {
        // No existing data or data is older than 30 minutes, fetch new data from GitHub API
        const [repoResponse, commitsResponse] = await Promise.all([
          octokit.repos.get({ owner, repo }),
          octokit.repos.listCommits({ owner, repo, per_page: 5 }),
        ]);
  
        repoData = repoResponse.data;
        commitsData = commitsResponse.data;
      } else {
        // Use existing data if it's recent enough
        repoData = JSON.parse(existingDataResult.recordset[0].raw_json);
        commitsData = JSON.parse(existingDataResult.recordset[0].raw_commits_json);
      }
  
      const rawRepoJson = JSON.stringify(repoData);
      const rawCommitsJson = JSON.stringify(commitsData);
  
      if (existingDataResult.recordset.length > 0 && repoData && commitsData) {
        // Data exists, so update it with the new data from GitHub
        const updateQuery = `
          UPDATE GitHubRepoData
          SET repo_name = '${repoData.name.replace(/'/g, '\'\'')}',
              raw_json = '${rawRepoJson.replace(/'/g, '\'\'')}',
              raw_commits_json = '${rawCommitsJson.replace(/'/g, '\'\'')}',
              time_fetched = GETDATE()
          WHERE repo_url = '${url}'
        `;
        await sql.query(updateQuery);
      } else if (!existingDataResult.recordset.length) {
        // No existing data, insert new data into GitHubRepoData table
        const insertQuery = `
          INSERT INTO GitHubRepoData (id, repo_url, repo_name, raw_json, raw_commits_json, time_fetched)
          VALUES (${repoData.id},
            '${url}', '${repoData.name.replace(/'/g, '\'\'')}',
            '${rawRepoJson.replace(/'/g, '\'\'')}',
            '${rawCommitsJson.replace(/'/g, '\'\'')}',
            GETDATE())
        `;
        await sql.query(insertQuery);
      }
  
      return {
        id: repoData.id,
        repo_url: repoData.html_url,
        repo_name: repoData.name,
        raw_json: rawRepoJson,
        raw_commits_json: rawCommitsJson,
        time_fetched: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching GitHub repository data:', error);
      return { link: url }; // Return a minimal object with the link in case of an error
    }
  },

  getPullRequestInfo: async (url) => {
    const isGitHubPRUrl = /^https?:\/\/github\.com\/.+\/.+\/pull\/\d+$/.test(url);
    if (!isGitHubPRUrl) {
      return { link: url };
    }
  
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (!match) {
      console.error('Failed to parse GitHub URL:', url);
      return { link: url };
    }
  
    const [, owner, repo, prNumber] = match;
  
    try {
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ userAgent: 'CORE' });
  
      const [prResponse, commitsResponse] = await Promise.all([
        octokit.pulls.get({
          owner,
          repo,
          pull_number: parseInt(prNumber, 10)
        }),
        octokit.pulls.listCommits({
          owner,
          repo,
          pull_number: parseInt(prNumber, 10)
        })
      ]);
  
      const prData = prResponse.data;
      const commitsData = commitsResponse.data;
  
      const commits = commitsData.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: commit.commit.author.date
      }));
  
      return {
        id: prData.id,
        pr_url: prData.html_url,
        pr_title: prData.title,
        state: prData.state,
        author: prData.user.login,
        created_at: prData.created_at,
        updated_at: prData.updated_at,
        merged_at: prData.merged_at,
        merged_by: prData.merged_by ? prData.merged_by.login : null,
        additions: prData.additions,
        deletions: prData.deletions,
        changed_files: prData.changed_files,
        commits: commits,
        total_commits: prData.commits,
        time_fetched: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching GitHub pull request data:', error);
      return { link: url };
    }
  },

  getPostScore: async (postId) => {
    try {
      const result = await sql.query`
        SELECT boosts, detracts FROM posts WHERE id = ${postId}
      `;
      const boosts = result.recordset[0].boosts;
      const detracts = result.recordset[0].detracts;
      const score = boosts - detracts;
      return score;
    } catch (err) {
      console.error('Database query error:', err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  nestComments: async (commentList) => {
    const commentMap = {};

    // Create a map of comments
    commentList.forEach((comment) => {
      commentMap[comment.id] = { ...comment, replies: [] };
    });

    const nestedComments = [];
    for (let comment of commentList) {
      if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
        commentMap[comment.parent_comment_id].replies.push(
          commentMap[comment.id]
        );
      } else {
        nestedComments.push(commentMap[comment.id]);
      }
    }

    // Fetch user details for each comment
    for (let comment of nestedComments) {
      comment.user = await utilFunctions.getUserDetails(comment.user_id);
      for (let reply of comment.replies) {
        reply.user = await utilFunctions.getUserDetails(reply.user_id);
      }
    }

    return nestedComments;
  },

  getCommunityDetails: async (communityId) => {
    try {
      const result = await sql.query`
        SELECT * FROM communities WHERE id = ${communityId}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
};

module.exports = utilFunctions;
