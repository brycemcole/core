const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { checkAuthenticated } = require('../middleware/authMiddleware');
const postQueries = require('../queries/postQueries');
const utilFunctions = require('../utils/utilFunctions');
const getUserDetails = utilFunctions.getUserDetails;
const { getLinkPreview } = require('../utils/utilFunctions');
const userQueries = require('../queries/userQueries');
const marked = require('marked');
const rateLimit = require('express-rate-limit');
const PostController = require('../controllers/postController');
const viewLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  handler: (req, res, next) => {
    req.rateLimit = {
      exceeded: true,
    };
    next();
  },
  keyGenerator: (req) => `${req.ip}_${req.params.postId}`,
  skip: (req) => {
    const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;
    return req.rateLimit.resetTime && req.rateLimit.resetTime < eightHoursAgo;
  },
});

router.get('/posts', async (req, res) => {
  try {
    const posts = await postQueries.getPosts();
    res.render('posts.ejs', { user: req.user, error: null, posts: posts });
  } catch (err) {
    console.error('Database query error:', err);
    const error = { status: 500, message: 'Error fetching posts' };
    res.render('error.ejs', { user: req.user, error });
  }
});

// Route for creating a new post
router.post('/posts', checkAuthenticated, async (req, res) => {
  try {
    const { userId, title, content, link, community_id, tags, post_type } =
      req.body;

    const postId = await postQueries.createPost(
      userId,
      title,
      content,
      link,
      community_id,
      tags || [],
      post_type
    );

    return res.redirect(`/posts/${postId}`);
  } catch (err) {
    console.error('Database insert error:', err);
    res.status(500).render('error.ejs', {
      error: { status: 500, message: 'Error creating post' },
    });
  }
});

router.post(
  '/posts/:postId/answer/:commentId',
  checkAuthenticated,
  async (req, res) => {
    try {
      const postId = req.params.postId;
      const commentId = req.params.commentId;
      const userId = req.user.id;

      console.log(postId, commentId, userId);

      const result = await postQueries.acceptAnswer(postId, commentId, userId);

      if (result) {
        // redirect to the post page
        res.redirect(`/posts/${postId}`);
      }
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).send('Error accepting answer');
    }
  }
);

router.post('/posts/:postId/react', checkAuthenticated, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;
    const action = req.body.action.toUpperCase();
    const validActions = ['LOVE', 'LIKE', 'CURIOUS', 'DISLIKE'];

    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const result = await postQueries.interactWithPost(postId, userId, action);

    res.json({
      message: 'Post reaction updated successfully',
      userReaction: result.userReaction,
      totalReactions: result.totalReactions,
      reactionsMap: result.reactionsMap,
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Error processing reaction' });
  }
});

router.get('/posts/:postId', viewLimiter, async (req, res) => {
  try {
    const postId = req.params.postId;
    let user = req.user;

    let query = `
    SELECT
      c.id,
      c.created_at,
      c.deleted,
      c.comment,
      c.user_id,
      c.parent_comment_id,
      c.post_id,
      c.isPinned,
      SUM(CASE WHEN uca.action_type = 'LOVE' THEN 1 ELSE 0 END) AS loveCount,
      SUM(CASE WHEN uca.action_type = 'B' THEN 1 ELSE 0 END) AS boostCount,
      SUM(CASE WHEN uca.action_type = 'DISLIKE' THEN 1 ELSE 0 END) AS dislikeCount,
      SUM(CASE WHEN uca.action_type = 'CURIOUS' THEN 1 ELSE 0 END) AS curiousCount,
      SUM(CASE WHEN uca.action_type = 'LIKE' THEN 1 ELSE 0 END) AS likeCount,
      SUM(CASE WHEN uca.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) AS celebrateCount`;

    if (user && user.id) {
      query += `,
      (
        SELECT TOP 1 uca2.action_type
        FROM UserCommentActions uca2
        WHERE uca2.comment_id = c.id AND uca2.user_id = @userId
      ) AS userReaction`;
    }

    query += `
    FROM comments c
    LEFT JOIN UserCommentActions uca ON c.id = uca.comment_id
    WHERE c.post_id = @postId AND c.deleted = 0
    GROUP BY
      c.id,
      c.created_at,
      c.deleted,
      c.comment,
      c.isPinned,
      c.user_id,
      c.parent_comment_id,
      c.post_id
    ORDER BY c.created_at DESC;`;

    const request = new sql.Request();
    request.input('postId', sql.VarChar, postId);

    if (user && user.id) {
      request.input('userId', sql.VarChar, user.id);
    }

    const result = await request.query(query);

    // Function to nest comments
    function nestComments(commentList) {
      const commentMap = {};

      // Create a map of comments
      commentList.forEach((comment) => {
        commentMap[comment.id] = { ...comment, replies: [] };
      });

      const nestedComments = [];
      for (let comment of commentList) {
        if (
          comment.parent_comment_id &&
          commentMap[comment.parent_comment_id]
        ) {
          commentMap[comment.parent_comment_id].replies.push(
            commentMap[comment.id]
          );
        } else {
          nestedComments.push(commentMap[comment.id]);
        }
      }

      return nestedComments;
    }

    // Nest comments
    const nestedComments = nestComments(result.recordset);

    const fetchUserAndParentDetails = async (comment) => {
      comment.user = await getUserDetails(comment.user_id);

      // Fetch the user reaction for the current comment
      if (user) {
        const sqlRequest = new sql.Request();
        sqlRequest.input('commentId', sql.VarChar, comment.id);
        sqlRequest.input('userId', sql.VarChar, user.id);

        const reactionQuery = `
      SELECT action_type
      FROM UserCommentActions
      WHERE comment_id = @commentId AND user_id = @userId;
    `;

        try {
          const reactionResult = await sqlRequest.query(reactionQuery);
          comment.userReaction =
            reactionResult.recordset && reactionResult.recordset[0]
              ? reactionResult.recordset[0].action_type
              : null;
        } catch (error) {
          console.error('Database query error:', error);
          // Handle the error appropriately
        }
      } else {
        comment.userReaction = null;
      }

      // Use the new function to get the parent author's username
      if (comment.parent_comment_id || comment.post_id) {
        comment_parent_username =
          await postQueries.getParentAuthorUsernameByCommentId(comment.id);

        comment.parent_author = await userQueries.findByUsername(
          comment_parent_username
        );
        comment.replyingTo = comment.parent_comment_id ? 'comment' : 'post';
      }

      if (comment.replies && comment.replies.length > 0) {
        await Promise.all(comment.replies.map(fetchUserAndParentDetails));
      }
    };

    // Fetch user and parent author details for all comments in parallel
    await Promise.all(nestedComments.map(fetchUserAndParentDetails));

    // Fetch post details
    const postResult = await utilFunctions.getPostData(postId, req.user);

    // Construct postData
    const postData = {
      ...postResult,
      tags: await utilFunctions.getTags(postId),
      user: await getUserDetails(postResult.user_id),
      comments: nestedComments,
    };

    if (postData.link && postData.post_type === 'project') {
      postData.gitHubfavicon = await utilFunctions.getFavicon(postData.link);
      postData.gitHubLinkPreview = await utilFunctions.getGitHubRepoPreview(
        postData.link
      );
      postData.gitHubMatchUsername =
        postData.user.github_url ==
        JSON.parse(postData.gitHubLinkPreview.raw_json).owner.login;
    }

    if (postData.post_type === 'question') {
      postData.solution = await postQueries.getAcceptedAnswer(postId);
      if (postData.solution) {
        postData.solution.user = await getUserDetails(
          postData.solution.user_id
        );
      }
    }

    // Add link preview to postData if link exists
    if (postData.link) {
      postData.linkPreview = await getLinkPreview(postData.link);
    }
    postData.community = await utilFunctions.getCommunityDetails(
      postData.communities_id
    );

    // render markup content in html
    postData.content = marked.parse(postData.content);

    const similarPosts = await postQueries.fetchSimilarPosts(
      user,
      postId,
      postData.communities_id,
      postData.tags,
      postData.title
    );

    res.render('post.ejs', {
      post: postData,
      user: req.user,
      communityId: postData.communities_id,
      community: postData.community,
      linkify: utilFunctions.linkify,
      similarPosts: similarPosts,
    });
  } catch (err) {
    console.error('Database query error:', err);
    res.redirect('/');
  }
});

router.get('/posts/:postId/edit', checkAuthenticated, async (req, res) => {
  try {
    const postId = req.params.postId;
    const post = await postQueries.getPostById(postId);
    if (post.user_id !== req.user.id) {
      return res.status(403).send('You are not authorized to edit this post');
    }
    post.community_name = await utilFunctions.getCommunityName(
      post.communities_id,
      false
    );
    post.tags = await utilFunctions.getTags(postId);
    //console.log(post.tags);

    res.render('edit-post.ejs', { user: req.user, post });
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).send('Error fetching post');
  }
});

router.put('/posts/:postId/edit', checkAuthenticated, async (req, res) => {
  PostController.updatePost(req, res);
});

// Route for deleting a post
router.delete('/post/:postId', checkAuthenticated, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;

  try {
    const post = await postQueries.getPostById(postId);
    if (post.user_id !== userId) {
      return res.status(403).send('You are not authorized to delete this post');
    }

    await postQueries.deletePostById(postId);
    res.redirect('/');
  } catch (error) {
    res.status(500).send('Error deleting post');
  }
});

module.exports = router;
