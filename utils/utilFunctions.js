const sql = require("mssql");
const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");
const myCache = new NodeCache();

const utilFunctions = {
  fetchCommits: async () => {
    try {
      // Fetch the list of commits
      const commitListResponse = await fetch(
        "https://api.github.com/repos/brycemcole/CORE/commits"
      );
      if (!commitListResponse.ok) {
        throw new Error(
          `GitHub API responded with status ${commitListResponse.status}`
        );
      }

      const commitList = await commitListResponse.json();

      // Check if commitList is actually an array
      if (!Array.isArray(commitList)) {
        throw new Error(
          "Expected an array of commits but received something else."
        );
      }

      // Fetch detailed data for each commit
      const detailedCommits = await Promise.all(
        commitList.map(async (commit) => {
          const commitDetailResponse = await fetch(commit.url); // URL to fetch details of each commit
          if (!commitDetailResponse.ok) {
            throw new Error(
              `GitHub API responded with status ${commitDetailResponse.status} for commit details`
            );
          }

          const commitDetail = await commitDetailResponse.json();
          return {
            sha: commit.sha,
            author: commit.commit.author,
            message: commit.commit.message,
            stats: commitDetail.stats, // Contains additions and deletions
          };
        })
      );

      return detailedCommits;
    } catch (err) {
      console.error("Error fetching commit details:", err);
      throw err;
    }
  },

  displayCommits: async (commits) => {
    try {
      const commitsContainer = document.getElementById("commits-container");
      commitsContainer.innerHTML = ""; // Clear existing content

      commits.forEach((commit) => {
        const commitElement = document.createElement("div");
        commitElement.innerHTML = `
              <p>Author: ${commit.commit.author.name}</p>
              <p>Message: ${commit.commit.message}</p>
              <p>Added: ${commit.stats.additions} lines</p>
              <p>Deleted: ${commit.stats.deletions} lines</p>
          `;
        commitsContainer.appendChild(commitElement);
      });
    } catch (err) {
      console.error(err);
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
        return { id: userId, username: "unknown", avatar: null };
      }
    } catch (err) {
      console.error("Database query error:", err);
      // Optionally, you can still return a default user object in case of query error
      return { id: userId, username: "error", avatar: null };
    }
  },

  linkify: (text) => {
    const urlRegex =
      /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
    return text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" class="comment-url">${url}</a>`;
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
        if (!user.firstname) missingFields.push("firstname");
        if (!user.lastname) missingFields.push("lastname");
      }
      return missingFields;
    } catch (err) {
      console.error("Error in checking missing fields:", err);
    }
  },

  getLinkPreview: async (url) => {
    try {
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3", // Set a user agent
      };
      const response = await axios.get(url, {
        headers: headers,
        timeout: 5000,
      }); // Set timeout as 5 seconds
      const { data, status } = response;

      // Ensure that the request was successful
      if (status !== 200) {
        throw new Error(`Request failed with status code ${status}`);
      }
      const $ = cheerio.load(data);

      const getMetaTag = (name) => {
        return (
          $(`meta[name=${name}]`).attr("content") ||
          $(`meta[name="twitter${name}"]`).attr("content") ||
          $(`meta[name="og${name}"]`).attr("content")
        );
      };

      const preview = {
        url,
        title: $("title").first().text(),
        favicon:
          $('link[rel="shortcut icon"]').attr("href") ||
          $('link[rel="alternate icon"]').attr("href"),
        description: getMetaTag("description"),
        image: getMetaTag("image"),
        author: getMetaTag("author"),
      };

      return preview;
    } catch (error) {
      console.error("Error fetching URL:", error);
      return null;
    }
  },

  getComments: async (postId) => {
    try {
      const result = await sql.query`
        SELECT * FROM comments WHERE post_id = ${postId} AND deleted = 0
      `;
      const commentList = result.recordset;
      return await utilFunctions.getNestedComments(commentList);
    } catch (err) {
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },

  getNestedComments: async (commentList) => {
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
      console.error("Database query error:", err);
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
      console.error("Database query error:", err);
      throw err; // Rethrow the error for the caller to handle
    }
  },
};

module.exports = utilFunctions;
