const searchService = require('../services/searchService');

exports.searchAll = async (req, res) => {
  try {
    const { searchTerm } = req.query;
    const [postResults, userResults, jobResults] = await Promise.all([
      searchService.findPosts(searchTerm),
      searchService.findUsers(searchTerm),
      searchService.findJobs(searchTerm),
    ]);

    res.render('search.ejs', {
      searchTerm: searchTerm,
      posts: postResults.recordset,
      users: userResults.recordset,
      jobs: jobResults.recordset,
      user: req.user,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send('Server error occurred while searching');
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { searchTerm } = req.query;
    const userResults = await searchService.findUsers(searchTerm);

    res.render('search.ejs', {
      searchTerm: searchTerm,
      posts: [],
      users: userResults.recordset,
      jobs: [],
      user: req.user,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send('Server error occurred while searching users');
  }
};

exports.searchPosts = async (req, res) => {
  try {
    const { searchTerm } = req.query;
    const postResults = await searchService.findPosts(searchTerm);

    res.render('search.ejs', {
      searchTerm: searchTerm,
      posts: postResults.recordset,
      users: [],
      jobs: [],
      user: req.user,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send('Server error occurred while searching posts');
  }
};

exports.searchJobs = async (req, res) => {
  try {
    const { searchTerm } = req.query;
    const jobResults = await searchService.findJobs(searchTerm);

    res.render('search.ejs', {
      searchTerm: searchTerm,
      posts: [],
      users: [],
      jobs: jobResults.recordset,
      user: req.user,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send('Server error occurred while searching jobs');
  }
};

exports.searchPreview = async (req, res) => {
  try {
    const { searchTerm } = req.query;
    // Initiate all search queries in parallel
    const [postResults, userResults, jobResults] = await Promise.all([
      searchService.findPosts(searchTerm),
      searchService.findUsers(searchTerm),
      searchService.findJobs(searchTerm),
    ]);

    // Aggregate results
    const results = {
      posts: postResults.recordset, // Assuming the result structure from mssql
      users: userResults.recordset,
      jobs: jobResults.recordset,
    };

    // Return JSON response with all results
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error occurred while searching' });
  }
};
