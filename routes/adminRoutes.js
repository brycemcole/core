const express = require("express");
const router = express.Router();
const sql = require("mssql");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/authMiddleware");
const postQueries = require("../queries/postQueries");
const userQueries = require("../queries/userQueries");
const notificationQueries = require("../queries/notificationQueries");

router.delete("/post/:postId", checkAuthenticated, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;

  try {
    const post = await postQueries.getPostById(postId);
    const user = await userQueries.findById(userId);

    if (!post) {
      return res.status(404).send("Post not found");
    }

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (!user.isAdmin) {
      return res.status(401).send("Unauthorized");
    }

    const originalPostAuthorId = post.userId;

    await postQueries.deletePostById(postId);

    await notificationQueries.createNotification(
      userId,
      originalPostAuthorId,
      "ADMIN_DELETED",
      postId
    );
    res.send({ message: "Post deleted" });
  } catch (error) {
    res.status(500).send("Error deleting post");
  }
});

router.delete("/comment/:commentId", checkAuthenticated, async (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.id;

  try {
    const comment = await postQueries.getCommentById(commentId);
    const user = await userQueries.findById(userId);

    if (!comment) {
      return res.status(404).send("Comment not found");
    }

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (!user.isAdmin) {
      return res.status(401).send("Unauthorized");
    }

    await postQueries.deleteCommentById(commentId);

    const originalPostAuthorId = comment.userId;
    const postId = comment.postId;

    await notificationQueries.createNotification(
      userId,
      originalPostAuthorId,
      "ADMIN_DELETED_COMMENT",
      postId
    );
    res.send({ message: "Comment deleted" });
  } catch (error) {
    res.status(500).send("Error deleting comment");
  }
});

router.post(
  "/users/:userId/toggle-admin",
  checkAuthenticated,
  async (req, res) => {
    const userId = req.params.userId;
    const currentUserId = req.user.id;

    try {
      const user = await userQueries.findById(userId);
      const currentUser = await userQueries.findById(currentUserId);

      if (!user) {
        return res.status(404).send("User not found");
      }

      if (!currentUser) {
        return res.status(404).send("Current user not found");
      }

      if (!currentUser.isAdmin) {
        return res.status(401).send("Unauthorized");
      }

      const result = await userQueries.toggleAdmin(userId);

      await notificationQueries.createNotification(
        currentUserId,
        userId,
        result.isAdmin ? "ADMIN_MADE" : "ADMIN_REMOVED",
        null
      );
      res.send({ message: result.message });
    } catch (error) {
      res.status(500).send("Error toggling admin");
    }
  }
);

router.post(
  "/users/:userId/toggle-verified",
  checkAuthenticated,
  async (req, res) => {
    const userId = req.params.userId;
    const currentUserId = req.user.id;

    try {
      const user = await userQueries.findById(userId);
      const currentUser = await userQueries.findById(currentUserId);

      if (!user) {
        return res.status(404).send("User not found");
      }

      if (!currentUser) {
        return res.status(404).send("Current user not found");
      }

      if (!currentUser.isAdmin) {
        return res.status(401).send("Unauthorized");
      }

      const result = await userQueries.toggleVerified(userId);

      await notificationQueries.createNotification(
        currentUserId,
        userId,
        result.verified ? "ADMIN_VERIFIED" : "ADMIN_UNVERIFIED",
        null
      );
      res.send({ message: result.message });
    } catch (error) {
      res.status(500).send("Error toggling verified");
    }
  }
);

router.post(
  "/users/:userId/toggle-ban",
  checkAuthenticated,
  async (req, res) => {
    const userId = req.params.userId;
    const currentUserId = req.user.id;

    try {
      const user = await userQueries.findById(userId);
      const currentUser = await userQueries.findById(currentUserId);

      if (!user) {
        return res.status(404).send("User not found");
      }

      if (!currentUser) {
        return res.status(404).send("Current user not found");
      }

      if (!currentUser.isAdmin) {
        return res.status(401).send("Unauthorized");
      }

      const result = await userQueries.toggleBan(userId);

      await notificationQueries.createNotification(
        currentUserId,
        userId,
        result.isBanned ? "ADMIN_BAN" : "ADMIN_UNBAN",
        null
      );
      res.send({ message: result.message });
    } catch (error) {
      res.status(500).send("Error toggling ban");
    }
  }
);

module.exports = router;
