const sql = require('mssql');
const utilFunctions = require('../utils/utilFunctions');
const resumeFunctions = require('../utils/resumeFunctions');
const config = require('../config/dbConfig');
const fs = require('fs');
const path = require('path');

/*
CREATE TABLE company_comments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    company_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    deleted BIT NOT NULL DEFAULT 0,
    parent_comment_id INT,
    is_pinned BIT NOT NULL DEFAULT 0,
    content NVARCHAR(MAX) NOT NULL,
    FOREIGN KEY (company_id) REFERENCES dbo.companies(id),
    FOREIGN KEY (parent_comment_id) REFERENCES dbo.company_comments(id)
);
*/

const jobTitleCategories = {
  'Software Engineer': ['Software Developer', 'Python Developer', 'Java Developer', 'Full Stack Developer', 'Backend Developer', 'Frontend Developer', 'iOS Developer', 'Android Developer', 'Web Developer', 'DevOps Engineer', 'Cloud Engineer'],
  'Data Scientist': ['Data Analyst', 'Machine Learning Engineer', 'AI Engineer', 'Business Intelligence Analyst', 'Data Engineer', 'Statistician'],
  'Product Manager': ['Product Owner', 'Program Manager', 'Project Manager', 'Scrum Master', 'Agile Coach'],
  // Add more categories as needed
};

const jobQueries = {

  createResume: async (data) => {
    resumeFunctions.createResume(data);
    console.log('Resume created');
  },

  readResume: async (filePath) => {
    try {
      const data = await resumeFunctions.processResume(filePath);
      return data;
    } catch (error) {
      console.error('Error reading resume:', error);
      throw error;
    }
  },

  getAllCompanies: async () => {
    try {
      const result = await sql.query`
        SELECT * FROM companies
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  updateJobBoardUrl: async (companyId, jobBoardUrl) => {
    try {
      const result = await sql.query`
        UPDATE companies
        SET job_board_url = ${jobBoardUrl}
        WHERE id = ${companyId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getAllCompanyJobBoards: async () => {
    try {
      const result = await sql.query`
        SELECT id, job_board_url FROM companies
        WHERE job_board_url IS NOT NULL
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCompanyJobLinks: async (companyId) => {
    try {
      const result = await sql.query`
        SELECT id, title, link FROM JobPostings WHERE company_id = ${companyId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getAllCompanyJobLinks: async () => {
    try {
      const result = await sql.query`
        SELECT id, title, link, company_id FROM JobPostings
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    } 
  },

  getCompanyJobs: async (companyId) => {
    try {
      const result = await sql.query`
        SELECT id, title, link, company_id FROM JobPostings WHERE company_id = ${companyId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  
  incrementJobApplicantCount: async (jobId) => {
    try {
      if (!jobId) {
        throw new Error('jobId is required');
      }

      await sql.query`
        UPDATE JobPostings
        SET applicants = COALESCE(applicants, 0) + 1
        WHERE id = ${jobId}`;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  decrementJobApplicantCount: async (jobId) => {
    try {
      if (!jobId) {
        throw new Error('jobId is required');
      }

      await sql.query`
        UPDATE JobPostings
        SET applicants = COALESCE(applicants, 0) - 1
        WHERE id = ${jobId}`;
    }
    catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },



  //const jobPostings = await jobQueries.getJobsByCompanies(parsedCompanies, page, pageSize);

  /*
  parsedCompanies [
  '{"id":"71","name":"Apple","logo":"/src/applelogo.png"}',
  '{"id":"86","name":"Microsoft","logo":"/src/Microsoftlogo.png"}'
  ]
  */
 

  
  getJobsByCompanies: async (companyIds, page, pageSize) => {
    try {
      const offset = (page - 1) * pageSize;
      console.log(companyIds);
  
      // Create a string of @p1, @p2, etc. for each companyId
      const parameterPlaceholders = companyIds.map((_, index) => `@p${index + 1}`).join(',');
  
      const request = new sql.Request();
  
      // Add parameters for each companyId
      companyIds.forEach((id, index) => {
        request.input(`p${index + 1}`, sql.Int, id);
      });
  
      // Add parameters for offset and pageSize
      request.input('offset', sql.Int, offset);
      request.input('pageSize', sql.Int, pageSize);
  
      const query = `
        SELECT 
          JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
          (
            SELECT STRING_AGG(JobTags.tagName, ', ')
            FROM JobPostingsTags
            INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
            WHERE JobPostingsTags.jobId = JobPostings.id
          ) AS tags,
          (
            SELECT STRING_AGG(s.name, ', ')
            FROM job_skills js
            JOIN skills s ON js.skill_id = s.id
            WHERE js.job_id = JobPostings.id
          ) AS skills
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.company_id IN (${parameterPlaceholders})
        ORDER BY JobPostings.postedDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `;
  
      const result = await request.query(query);
      const jobs = result.recordset;
      return jobs;
    }
    catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },



  searchJobLevels: async (searchTerm) => {
    try {
      searchTerm = searchTerm.toLowerCase();
      const result = await sql.query`
        SELECT experienceLevel, COUNT(*) as jobCount
        FROM JobPostings
        WHERE experienceLevel LIKE ${'%' + searchTerm + '%'}
        GROUP BY experienceLevel
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },


  searchJobLocations: async (searchTerm) => {
    try {
      const result = await sql.query`
        SELECT location, COUNT(*) as jobCount 
        FROM JobPostings 
        WHERE location LIKE ${'%' + searchTerm + '%'}
        GROUP BY location
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },


  updateCompanyJobBoards: async (companyId, jobBoardUrl) => {
    try {
      const result = await sql.query`
        UPDATE companies
        SET job_board_url = ${jobBoardUrl}
        WHERE id = ${companyId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  searchCompanies: async (searchTerm) => {
    try {
      const result = await sql.query`
        SELECT TOP 5 c.id, c.name, c.logo, COUNT(jp.id) AS job_count
        FROM companies c
        LEFT JOIN JobPostings jp ON c.id = jp.company_id
        WHERE c.name LIKE ${'%' + searchTerm + '%'}
        GROUP BY c.id, c.name, c.logo
        ORDER BY job_count DESC, c.name
      `;
  
      return result.recordset.map(record => ({
        id: record.id,
        name: record.name,
        logo: record.logo,
        jobCount: record.job_count
      }));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  searchJobs: async (searchTerm) => {
    try {
      const result = await sql.query`
          SELECT * FROM jobPostings WHERE title LIKE ${'%' + searchTerm + '%'}`;

      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCompaniesCount: async () => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) as count FROM companies
      `;
      return result.recordset[0].count;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getJobs: async (limit, offset) => {
    try {
      const result = await sql.query(`
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
        (
          SELECT STRING_AGG(JobTags.tagName, ', ')
          FROM JobPostingsTags
          INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
          WHERE JobPostingsTags.jobId = JobPostings.id
        ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        ORDER BY JobPostings.postedDate DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCompanyComments: async (companyId) => {
    // get company comments and join in user data
    try {
      const result = await sql.query`
        SELECT cc.*, u.username as user_name, u.id as user_id, u.avatar as user_avatar
        FROM company_comments cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.company_id = ${companyId} AND cc.deleted = 0
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  addCompanyComment: async (comment) => {
    try {
      const result = await sql.query`
        INSERT INTO company_comments (company_id, user_id, content, parent_comment_id)
        VALUES (${comment.company_id}, ${comment.user_id}, ${comment.content}, ${comment.parent_comment_id})
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  deleteCompanyComment: async (commentId) => {
    try {
      const result = await sql.query`
        UPDATE company_comments
        SET deleted = 1
        WHERE id = ${commentId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getSkill: async (skillName) => {
    try {
      const result = await sql.query`
        SELECT * FROM skills WHERE name = ${skillName}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  
  async getJobsBatch(offset, batchSize) {
    try {
      await sql.connect(config);
      const result = await sql.query`
        SELECT id, title, description
        FROM JobPostings
        ORDER BY id
        OFFSET ${offset} ROWS
        FETCH NEXT ${batchSize} ROWS ONLY
      `;
      return result.recordset;
    } catch (err) {
      console.error('SQL error in getJobsBatch:', err);
      throw err;
    } finally {
      await sql.close();
    }
  },

  async flagJobForReview(jobId) {
    try {
      await sql.connect(config);
      await sql.query`
        UPDATE JobPostings
        SET needs_review = 1
        WHERE id = ${jobId}
      `;
    } catch (err) {
      console.error(`SQL error in flagJobForReview for job ${jobId}:`, err);
      throw err;
    } finally {
      await sql.close();
    }
  },

  getAllJobs: async () => {
    try {
      const result = await sql.query(`
        select * from JobPostings
      `);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getRecentJobs: async (page = 1, pageSize = 20) => {
    try {
      const offset = (page - 1) * pageSize;
      const result = await sql.query`
        SELECT 
          j.id,
          j.title,
          j.description,
          j.postedDate,
          j.experienceLevel,
          j.salary,
          j.location,
          j.link,
          c.name AS company_name,
          c.logo AS company_logo,
          c.location AS company_location,
          c.description AS company_description,
          -- Aggregating tags using a correlated subquery
          (
            SELECT STRING_AGG(jt.tagName, ', ') 
            FROM JobPostingsTags jpt
            JOIN JobTags jt ON jpt.tagId = jt.id
            WHERE jpt.jobId = j.id
          ) AS tags,
          -- Aggregating skills using a correlated subquery
          (
            SELECT STRING_AGG(s.name, ', ') 
            FROM job_skills js
            JOIN skills s ON js.skill_id = s.id
            WHERE js.job_id = j.id
          ) AS skills
        FROM JobPostings j
        LEFT JOIN companies c ON j.company_id = c.id
        ORDER BY j.postedDate DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  
  

  getJobCountByCompany: async (companyName) => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) as count
        FROM JobPostings jp
        INNER JOIN companies c ON jp.company_id = c.id
        WHERE c.name = ${companyName}
      `;
      return result.recordset[0].count;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  deleteJobsOlderThan2Months: async () => {
    try {
      await sql.query`
        DELETE FROM JobPostings
        WHERE postedDate < DATEADD(month, -2, GETDATE())
      `;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getAllJobsFromLast30Days: async (userPreferences, page, pageSize) => {
    try {
      let query = `
        SELECT 
          j.*,
          c.name AS company_name, 
          c.logo AS company_logo, 
          c.location AS company_location, 
          c.description AS company_description,
          (
            SELECT STRING_AGG(jt.tagName, ', ')
            FROM JobPostingsTags jpt
            JOIN JobTags jt ON jpt.tagId = jt.id
            WHERE jpt.jobId = j.id
          ) AS tags,
          (
            SELECT STRING_AGG(s.name, ', ')
            FROM job_skills js
            JOIN skills s ON js.skill_id = s.id
            WHERE js.job_id = j.id
          ) AS skills
        FROM JobPostings j
        LEFT JOIN companies c ON j.company_id = c.id
      `;

      const conditions = [];
      const queryParams = {};

      if (userPreferences.jobPreferredTitle) {
        conditions.push('j.title LIKE @title');
        queryParams.title = `%${userPreferences.jobPreferredTitle}%`;
      }

      if (userPreferences.jobPreferredLocation) {
        conditions.push(
          '(j.location LIKE @location OR j.location LIKE @stateAbbr)'
        );
        queryParams.location = `%${userPreferences.jobPreferredLocation}%`;
        queryParams.stateAbbr = `% ${userPreferences.jobPreferredLocation.substring(
          0,
          2
        )},%`;
      }

      if (userPreferences.jobExperienceLevel) {
        conditions.push('j.experienceLevel = @experienceLevel');
        queryParams.experienceLevel = userPreferences.jobExperienceLevel;
      }

      if (
        userPreferences.jobPreferredSalary &&
        userPreferences.jobPreferredSalary > 0
      ) {
        conditions.push('j.salary >= @salary');
        queryParams.salary = userPreferences.jobPreferredSalary;
      }

      if (userPreferences.jobPreferredIndustry) {
        conditions.push('c.industry = @industry');
        queryParams.industry = userPreferences.jobPreferredIndustry;
      }

      if (
        userPreferences.jobPreferredSkills &&
        userPreferences.jobPreferredSkills.length > 0
      ) {
        const validSkills = userPreferences.jobPreferredSkills.filter(
          (skill) => !isNaN(skill)
        );
        if (validSkills.length > 0) {
          conditions.push(`
            EXISTS (
              SELECT 1 FROM job_skills js
              WHERE js.job_id = j.id AND js.skill_id IN (${validSkills
    .map((_, i) => `@skill${i}`)
    .join(', ')})
            )
          `);
          validSkills.forEach((skill, i) => {
            queryParams[`skill${i}`] = skill;
          });
        }
      }

      if (conditions.length > 0) {
        query += ` AND ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY j.postedDate DESC';

      const request = new sql.Request();
      Object.entries(queryParams).forEach(([key, value]) => {
        request.input(key, value);
      });

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error in getAllJobsFromLast30Days:', error);
      throw error;
    }
  },

  
  searchAllJobsFromLast30Days: async (filters, page, pageSize) => {
    try {
      console.log('Searching for jobs with filters:', filters);
      const {
        titles = [],
        locations = [],
        experienceLevels = [],
        salary = 0,
        skills = [],
        companies = []
      } = filters;
  
      const offset = (page - 1) * pageSize;
  
      // Initialize conditions and query parameters
      const conditions = [];
      const queryParams = {};
  
      // State mappings for abbreviations
      const stateMappings = {
        Alabama: 'AL',
        Alaska: 'AK',
        Arizona: 'AZ',
        Arkansas: 'AR',
        California: 'CA',
        Colorado: 'CO',
        Connecticut: 'CT',
        Delaware: 'DE',
        Florida: 'FL',
        Georgia: 'GA',
        Hawaii: 'HI',
        Idaho: 'ID',
        Illinois: 'IL',
        Indiana: 'IN',
        Iowa: 'IA',
        Kansas: 'KS',
        Kentucky: 'KY',
        Louisiana: 'LA',
        Maine: 'ME',
        Maryland: 'MD',
        Massachusetts: 'MA',
        Michigan: 'MI',
        Minnesota: 'MN',
        Mississippi: 'MS',
        Missouri: 'MO',
        Montana: 'MT',
        Nebraska: 'NE',
        Nevada: 'NV',
        'New Hampshire': 'NH',
        'New Jersey': 'NJ',
        'New Mexico': 'NM',
        'New York': 'NY',
        'North Carolina': 'NC',
        'North Dakota': 'ND',
        Ohio: 'OH',
        Oklahoma: 'OK',
        Oregon: 'OR',
        Pennsylvania: 'PA',
        'Rhode Island': 'RI',
        'South Carolina': 'SC',
        'South Dakota': 'SD',
        Tennessee: 'TN',
        Texas: 'TX',
        Utah: 'UT',
        Vermont: 'VT',
        Virginia: 'VA',
        Washington: 'WA',
        'West Virginia': 'WV',
        Wisconsin: 'WI',
        Wyoming: 'WY',
        'United States': 'US',
      };
  
      if (experienceLevels.length > 0) {
        const experienceLevelConditions = [];
  
        // Handle 'Internship' special case
        if (experienceLevels.includes('Internship')) {
          const internshipTitles = ['Intern', 'Internship', 'Co-op'];
          experienceLevelConditions.push(`(${internshipTitles.map((_, i) => `j.title LIKE @internTitle${i}`).join(' OR ')})`);
          internshipTitles.forEach((title, i) => {
            queryParams[`internTitle${i}`] = `%${title}%`;
          });
        }
  
        // Handle other experience levels
        const otherExperienceLevels = experienceLevels.filter(level => level !== 'Internship');
        if (otherExperienceLevels.length > 0) {
          otherExperienceLevels.forEach((level, index) => {
            if (level.toLowerCase() === 'senior') {
              queryParams['seniorTitle'] = '%Senior%';
              experienceLevelConditions.push('j.title LIKE @seniorTitle');
            } else {
              const paramName = `experienceLevel${index}`;
              experienceLevelConditions.push(`j.experienceLevel = @${paramName}`);
              queryParams[paramName] = level;
            }
          });
        }
  
        // Combine experience level conditions
        if (experienceLevelConditions.length > 0) {
          conditions.push(`(${experienceLevelConditions.join(' OR ')})`);
        }
      }
  
      // Handle titles with trailing wildcards and related job titles
      if (titles.length > 0) {
        const jobTitleCategories = {
          'Software Engineer': [
            'Developer',
            'Programmer',
            'Backend Engineer',
            'Frontend Engineer',
            'Full Stack Developer',
            'Python Developer',
            'Java Developer',
            'C++ Developer',
            'Software Developer',
            'Mobile Developer',
            'Application Developer'
          ],
          'Data Scientist': [
            'Data Analyst',
            'Machine Learning Engineer',
            'AI Specialist',
            'Data Engineer',
            'Statistician',
            'Quantitative Analyst',
            'Research Scientist'
          ],
          'Product Manager': [
            'Project Manager',
            'Product Owner',
            'Program Manager',
            'Scrum Master',
            'Product Coordinator'
          ],
          'UX Designer': [
            'User Experience Designer',
            'UI/UX Designer',
            'Interaction Designer',
            'Product Designer',
            'UI Designer',
            'Visual Designer'
          ],
          'DevOps Engineer': [
            'Site Reliability Engineer',
            'Systems Engineer',
            'Infrastructure Engineer',
            'Build Engineer',
            'Release Engineer',
            'Platform Engineer'
          ],
          'Quality Assurance': [
            'QA Engineer',
            'Test Engineer',
            'Quality Engineer',
            'Software Tester',
            'QA Analyst',
            'Automation Tester'
          ],
          'Business Analyst': [
            'BA',
            'Systems Analyst',
            'Functional Analyst',
            'Business Systems Analyst',
            'Requirements Analyst'
          ],
          'Marketing Manager': [
            'Digital Marketing Manager',
            'Marketing Specialist',
            'Brand Manager',
            'Marketing Coordinator',
            'Marketing Director',
            'SEO Specialist'
          ],
          'Sales Representative': [
            'Account Executive',
            'Sales Associate',
            'Sales Consultant',
            'Sales Manager',
            'Business Development Manager',
            'Account Manager'
          ],
          'Human Resources': [
            'HR Manager',
            'Talent Acquisition Specialist',
            'Recruiter',
            'HR Generalist',
            'HR Coordinator',
            'HR Business Partner'
          ],
          'Financial Analyst': [
            'Investment Analyst',
            'Equity Analyst',
            'Research Analyst',
            'Portfolio Analyst',
            'Financial Consultant',
            'Credit Analyst'
          ],
          'Customer Support': [
            'Customer Service Representative',
            'Technical Support',
            'Support Specialist',
            'Help Desk Technician',
            'Client Services',
            'Customer Success Manager'
          ],
          'Network Engineer': [
            'Network Administrator',
            'Network Architect',
            'Network Specialist',
            'Network Technician',
            'Network Analyst'
          ],
          'Database Administrator': [
            'DBA',
            'Database Engineer',
            'Data Architect',
            'Database Analyst',
            'SQL Developer'
          ],
          'Content Writer': [
            'Copywriter',
            'Technical Writer',
            'Editor',
            'Content Strategist',
            'Content Creator',
            'Blogger'
          ],
          'Graphic Designer': [
            'Visual Designer',
            'Creative Designer',
            'Multimedia Designer',
            'Digital Designer',
            'Art Director',
            'Illustrator'
          ],
          'Accountant': [
            'CPA',
            'Financial Accountant',
            'Staff Accountant',
            'Auditor',
            'Tax Accountant',
            'Accounting Manager'
          ],
          'Operations Manager': [
            'Operations Director',
            'Business Operations Manager',
            'Operations Coordinator',
            'Chief Operating Officer',
            'Operations Analyst'
          ],
          'Executive Assistant': [
            'Personal Assistant',
            'Administrative Assistant',
            'Office Manager',
            'Secretary',
            'Office Administrator',
            'Executive Secretary'
          ],
          'Legal Counsel': [
            'Attorney',
            'Lawyer',
            'Corporate Counsel',
            'Legal Advisor',
            'In-house Counsel',
            'Compliance Officer'
          ],
          'Mechanical Engineer': [
            'Mechanical Designer',
            'AutoCAD Engineer',
            'HVAC Engineer',
            'Manufacturing Engineer',
            'Process Engineer'
          ],
          'Electrical Engineer': [
            'Electronics Engineer',
            'Circuit Design Engineer',
            'Control Systems Engineer',
            'Power Engineer',
            'Instrumentation Engineer'
          ],
          'Civil Engineer': [
            'Structural Engineer',
            'Construction Engineer',
            'Geotechnical Engineer',
            'Transportation Engineer',
            'Environmental Engineer'
          ],
          'Chemist': [
            'Analytical Chemist',
            'Organic Chemist',
            'Research Scientist',
            'Lab Technician',
            'Chemical Engineer'
          ],
          'Teacher': [
            'Educator',
            'Instructor',
            'Professor',
            'Lecturer',
            'Tutor'
          ],
          'Nurse': [
            'Registered Nurse',
            'RN',
            'Staff Nurse',
            'Clinical Nurse',
            'Nurse Practitioner'
          ],
          'Doctor': [
            'Physician',
            'Medical Doctor',
            'General Practitioner',
            'Surgeon',
            'Clinician'
          ],
          'Pharmacist': [
            'Clinical Pharmacist',
            'Retail Pharmacist',
            'Hospital Pharmacist',
            'Pharmacy Manager',
            'Dispensary Pharmacist'
          ],
          'Architect': [
            'Design Architect',
            'Project Architect',
            'Interior Designer',
            'Landscape Architect',
            'Urban Planner'
          ],
          'Logistics Manager': [
            'Supply Chain Manager',
            'Transportation Manager',
            'Warehouse Manager',
            'Distribution Manager',
            'Inventory Manager'
          ],
          'Security Officer': [
            'Security Guard',
            'Security Specialist',
            'Loss Prevention Officer',
            'Surveillance Officer',
            'Security Manager'
          ],
          'Web Developer': [
            'Frontend Developer',
            'Backend Developer',
            'Full Stack Developer',
            'Web Designer',
            'JavaScript Developer'
          ],
          'Data Entry Clerk': [
            'Data Processor',
            'Administrative Assistant',
            'Office Assistant',
            'Clerical Worker',
            'Records Clerk'
          ],
          'Software Architect': [
            'Application Architect',
            'Systems Architect',
            'Technical Lead',
            'Solutions Architect',
            'Enterprise Architect'
          ],
          'System Administrator': [
            'SysAdmin',
            'IT Administrator',
            'Network Administrator',
            'Systems Engineer',
            'IT Support Specialist'
          ],
          'HR Specialist': [
            'Human Resources Specialist',
            'HR Coordinator',
            'Recruitment Specialist',
            'Talent Acquisition',
            'HR Advisor'
          ],
          'Digital Marketer': [
            'SEO Specialist',
            'Social Media Manager',
            'Content Marketer',
            'PPC Specialist',
            'Email Marketer'
          ],
          'Project Coordinator': [
            'Project Assistant',
            'Project Scheduler',
            'Project Support',
            'Program Coordinator',
            'Project Administrator'
          ]
        };
        
  
        const allTitles = titles.flatMap(title => {
          const relatedTitles = Object.entries(jobTitleCategories).find(([category, relatedJobs]) =>
            category.toLowerCase() === title.toLowerCase() || relatedJobs.map(job => job.toLowerCase()).includes(title.toLowerCase())
          );
          return relatedTitles ? [title, ...relatedTitles[1]] : [title];
        });
  
        conditions.push(`(${allTitles.map((_, i) => `j.title LIKE @title${i}`).join(' OR ')})`);
        allTitles.forEach((title, i) => {
          queryParams[`title${i}`] = `%${title}%`;
        });
      }
  
      // Handle locations with multiple OR conditions
      if (locations.length > 0) {
        const allLocations = locations.flatMap(location => {
          const abbreviation = stateMappings[location] || Object.keys(stateMappings).find(key => stateMappings[key] === location) || location;
          return abbreviation !== location ? [location, abbreviation] : [location];
        });
  
        const locationConditions = allLocations.map((location, i) => {
          if (Object.keys(stateMappings).includes(location)) {
            return `j.location LIKE @location${i}`;
          } else {
            return `j.location = @location${i}`;
          }
        });
  
        conditions.push(`(${locationConditions.join(' OR ')})`);
        allLocations.forEach((location, i) => {
          queryParams[`location${i}`] = `%${location}%`;
        });
      }
  
      // Handle salary
      if (salary > 0) {
        conditions.push('j.salary >= @salary');
        queryParams.salary = salary;
      }
  
      // Handle skills using EXISTS clauses
      if (skills.length > 0) {
        skills.forEach((skill, i) => {
          conditions.push(`EXISTS (
            SELECT 1 FROM job_skills js
            JOIN skills s ON js.skill_id = s.id
            WHERE js.job_id = j.id AND s.name = @skill${i}
          )`);
          queryParams[`skill${i}`] = skill;
        });
      }
  
      // Handle companies with multiple OR conditions
      if (companies.length > 0) {
        conditions.push(`(${companies.map((_, i) => `j.company_id = @company${i}`).join(' OR ')})`);
        companies.forEach((companyId, i) => {
          queryParams[`company${i}`] = companyId;
        });
      }
  
      // Build the main query with optimized CTEs and conditions
      let query =
      `WITH FilteredJobs AS (
        SELECT j.*
        FROM JobPostings j
        ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
      ),
      JobTagsAggregated AS (
        SELECT
          j.id,
          STRING_AGG(CONVERT(NVARCHAR(MAX), jt.tagName), ',') AS job_tags
        FROM FilteredJobs j
        LEFT JOIN JobPostingsTags jpt ON jpt.jobId = j.id
        LEFT JOIN JobTags jt ON jpt.tagId = jt.id
        GROUP BY j.id
      ),
      JobSkillsAggregated AS (
        SELECT
          j.id,
          STRING_AGG(CONVERT(NVARCHAR(MAX), s.name), ',') AS skills
        FROM FilteredJobs j
        LEFT JOIN job_skills js ON js.job_id = j.id
        LEFT JOIN skills s ON js.skill_id = s.id
        GROUP BY j.id
      )
      SELECT
        j.*,
        jta.job_tags,
        jsa.skills,
        c.name AS company_name,
        c.logo AS company_logo,
        c.location AS company_location,
        c.description AS company_description,
        CASE WHEN c.logo IS NOT NULL AND c.logo != '' THEN 1 ELSE 0 END AS has_logo
      FROM FilteredJobs j
      LEFT JOIN JobTagsAggregated jta ON j.id = jta.id
      LEFT JOIN JobSkillsAggregated jsa ON j.id = jsa.id
      LEFT JOIN companies c ON j.company_id = c.id
      ORDER BY
        has_logo DESC,
        j.postedDate DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
      ;`;
  
      // Prepare SQL request and input parameters
      const request = new sql.Request();
      Object.entries(queryParams).forEach(([key, value]) => {
        request.input(key, value);
      });
      request.input('offset', sql.Int, offset);
      request.input('pageSize', sql.Int, pageSize);
      if (salary > 0) {
        request.input('salary', sql.Int, salary);
      }
  
      // Execute the query
      const result = await request.query(query);
  
      return result.recordset;
    } catch (error) {
      console.error('Error in searchAllJobsFromLast30Days:', error);
      throw error;
    }
  },
  
  
  
  
  getJobTitles: async () => {
    try {
      const result = await sql.query`
        SELECT DISTINCT title FROM JobPostings
      `;
      const seenTitles = new Set();
      const jobTitles = result.recordset.reduce((acc, job, index) => {
        if (!seenTitles.has(job.title)) {
          seenTitles.add(job.title);
          acc.push({ id: acc.length + 1, name: job.title });
        }
        return acc;
      }, []);
      return jobTitles;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  incrementJobViewCount: async (postId) => {
    try {
      if (!postId) {
        throw new Error('postId is required');
      }

      await sql.query`
        UPDATE JobPostings
        SET views = COALESCE(views, 0) + 1
        WHERE id = ${postId}`;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getJobById: async (id) => {
    try {
      const result = await sql.query`
        SELECT * FROM JobPostings WHERE id = ${id}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  updateCompany: async (
    id,
    name = undefined,
    location = undefined,
    description = undefined,
    logo = undefined,
    logo_url = undefined,
    industry = undefined,
    founded = undefined,
    size = undefined,
    stock_symbol = undefined,
    job_board_url = undefined
  ) => {
    // Construct the SET clause dynamically
    const fields = [];
    const values = {};

    if (name !== undefined) {
      fields.push('name = @name');
      values.name = { value: name, type: sql.NVarChar };
    }
    if (location !== undefined) {
      fields.push('location = @location');
      values.location = { value: location, type: sql.NVarChar };
    }
    if (description !== undefined) {
      fields.push('description = @description');
      values.description = { value: description, type: sql.NVarChar };
    }
    if (logo !== undefined) {
      fields.push('logo = @logo');
      values.logo = { value: logo, type: sql.VarChar };
    }
    if (logo_url !== undefined) {
      fields.push('logo_url = @logo_url');
      values.logo_url = { value: logo_url, type: sql.VarChar };
    }
    if (industry !== undefined) {
      fields.push('industry = @industry');
      values.industry = { value: industry, type: sql.VarChar };
    }
    if (founded !== undefined) {
      fields.push('founded = @founded');
      values.founded = { value: founded, type: sql.DateTime };
    }
    if (size !== undefined) {
      fields.push('size = @size');
      values.size = { value: size, type: sql.VarChar };
    }
    if (stock_symbol !== undefined) {
      fields.push('stock_symbol = @stock_symbol');
      values.stock_symbol = { value: stock_symbol, type: sql.VarChar };
    }
    if (job_board_url !== undefined) {
      fields.push('job_board_url = @job_board_url');
      values.job_board_url = { value: job_board_url, type: sql.VarChar };
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
        UPDATE companies
        SET ${fields.join(', ')}
        WHERE id = @id
      `;

    const request = new sql.Request();
    request.input('id', sql.Int, id);
    Object.entries(values).forEach(([key, { value, type }]) => {
      request.input(key, type, value);
    });

    await request.query(query);
  },

  forceUpdateCompany: async (id, companyData) => {
    // Construct the SET clause dynamically
    const fields = [];
    const values = {};
  
    // List of valid fields that can be updated
    const validFields = [
      'name', 'location', 'description', 'logo', 'logo_url',
      'industry', 'founded', 'size', 'stock_symbol', 'job_board_url',
      'new_id', 'company_stage', 'company_recent_news_sentiment',
      'company_sentiment', 'company_issues', 'company_engineer_choice',
      'company_website', 'job_board_url2', 'job_board_url3',
      'company_linkedin_page', 'twitter_username'
    ];
  
    // Function to determine SQL type based on field name
    const getSqlType = (fieldName) => {
      if (fieldName === 'founded') return sql.DateTime;
      if (fieldName === 'new_id') return sql.UniqueIdentifier;
      if (['description', 'company_recent_news_sentiment', 'company_sentiment', 'company_issues', 'company_engineer_choice'].includes(fieldName)) {
        return sql.NVarChar;
      }
      return sql.VarChar;
    };
  
    // Iterate over valid fields and add them to the update if present in companyData
    for (const field of validFields) {
      if (companyData[field] !== undefined) {
        fields.push(`${field} = @${field}`);
        values[field] = { value: companyData[field], type: getSqlType(field) };
      }
    }
  
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
  
    const query = `
      UPDATE companies
      SET ${fields.join(', ')}
      WHERE id = @id
    `;
  
    const request = new sql.Request();
    request.input('id', sql.Int, id);
    Object.entries(values).forEach(([key, { value, type }]) => {
      request.input(key, type, value);
    });
  
    await request.query(query);
  },

  getUserJobPreferences: async (userId) => {
    try {
      const result = await sql.query`
        SELECT jobPreferredTitle, jobPreferredSkills, jobPreferredLocation, jobExperienceLevel, jobPreferredIndustry, jobPreferredSalary FROM users WHERE id = ${userId}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getRandomJobs: async (limit) => {
    try {
      const result = await sql.query(`
SELECT TOP ${limit} 
  jp.*,
  c.name AS company_name, 
  c.logo AS company_logo, 
  c.location AS company_location, 
  c.description AS company_description,
  s.job_skills
FROM JobPostings jp
LEFT JOIN companies c ON jp.company_id = c.id
LEFT JOIN (
  SELECT job_id, STRING_AGG(s.name, ', ') AS job_skills
  FROM job_skills js
  INNER JOIN skills s ON js.skill_id = s.id
  GROUP BY job_id
) s ON jp.id = s.job_id
WHERE jp.id >= (ABS(CHECKSUM(NEWID())) % (SELECT COUNT(*) FROM JobPostings))
ORDER BY jp.postedDate DESC
      `);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getRecent10Jobs: async () => {
    try {
      const result = await sql.query(`
        WITH RecentJobs AS (
          SELECT TOP 100 
            JobPostings.*,
            companies.name AS company_name, 
            companies.logo AS company_logo, 
            companies.location AS company_location, 
            companies.description AS company_description,
            (
              SELECT STRING_AGG(skills.name, ', ')
              FROM job_skills
              INNER JOIN skills ON job_skills.skill_id = skills.id
              WHERE job_skills.job_id = JobPostings.id
            ) AS job_skills
          FROM JobPostings
          LEFT JOIN companies ON JobPostings.company_id = companies.id
          ORDER BY JobPostings.postedDate DESC
        )
        SELECT TOP 10 *
        FROM RecentJobs
        ORDER BY NEWID()
      `);
  
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  getJobsBySearch: async (
    title = '',
    location = '',
    experienceLevel = '',
    salary = '',
    limit = null,
    offset = 0,
    allowedJobLevels = [],
    tags = []
  ) => {
    try {
      let query = `
        WITH FilteredJobs AS (
          SELECT j.id, j.title, j.salary, j.salary_max, j.experienceLevel, j.location, j.postedDate,
                 j.link, j.description, j.company_id, j.recruiter_id, j.views
          FROM JobPostings j
          WHERE 1=1
      `;

      const queryParams = {};
      const whereConditions = [];

      if (title) {
        whereConditions.push('j.title LIKE @title');
        queryParams.title = `%${title}%`;
      }

      if (location) {
        whereConditions.push(
          '(j.location LIKE @location OR j.location LIKE @stateAbbr)'
        );
        queryParams.location = `%${location}%`;
        queryParams.stateAbbr = `% ${location.substring(0, 2)},%`;
      }

      if (experienceLevel) {
        whereConditions.push('j.experienceLevel = @experienceLevel');
        queryParams.experienceLevel = experienceLevel;
      }

      if (salary) {
        whereConditions.push('j.salary >= @salary');
        queryParams.salary = parseInt(salary);
      }

      if (allowedJobLevels && allowedJobLevels.length > 0) {
        whereConditions.push(
          `j.experienceLevel IN (${allowedJobLevels
            .map((_, i) => `@level${i}`)
            .join(', ')})`
        );
        allowedJobLevels.forEach((level, i) => {
          queryParams[`level${i}`] = level;
        });
      }

      if (tags && tags.length > 0) {
        whereConditions.push(`
          EXISTS (
            SELECT 1
            FROM JobPostingsTags jpt
            JOIN JobTags jt ON jpt.tagId = jt.id
            WHERE jpt.jobId = j.id AND jt.tagName IN (${tags
    .map((_, i) => `@tag${i}`)
    .join(', ')})
            GROUP BY jpt.jobId
            HAVING COUNT(DISTINCT jt.tagName) = ${tags.length}
          )
        `);
        tags.forEach((tag, i) => {
          queryParams[`tag${i}`] = tag;
        });
      }

      if (whereConditions.length > 0) {
        query += ` AND ${whereConditions.join(' AND ')}`;
      }

      query += `
        )
        SELECT f.*, 
               c.name AS company_name, c.logo AS company_logo, c.location AS company_location, 
               c.description AS company_description,
               (
                 SELECT STRING_AGG(jt.tagName, ', ')
                 FROM JobPostingsTags jpt
                 JOIN JobTags jt ON jpt.tagId = jt.id
                 WHERE jpt.jobId = f.id
               ) AS tags,
               (
                 SELECT STRING_AGG(s.name, ', ')
                 FROM job_skills js
                 JOIN skills s ON js.skill_id = s.id
                 WHERE js.job_id = f.id
               ) AS skills
        FROM FilteredJobs f
        LEFT JOIN companies c ON f.company_id = c.id
        ORDER BY f.postedDate DESC
      `;

      if (limit !== null) {
        query += ' OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
        queryParams.offset = offset;
        queryParams.limit = limit;
      }

      const request = new sql.Request();
      Object.entries(queryParams).forEach(([key, value]) => {
        request.input(key, value);
      });

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error in getJobsBySearch:', error);
      throw error;
    }
  },

  getJobsCount: async (allowedJobLevels, tags) => {
    try {
      let query = `
        SELECT COUNT(DISTINCT j.id) as count
        FROM JobPostings j
        WHERE 1=1
      `;

      const queryParams = {};

      if (allowedJobLevels && allowedJobLevels.length > 0) {
        query += ` AND j.experienceLevel IN (${allowedJobLevels
          .map((_, i) => `@level${i}`)
          .join(', ')})`;
        allowedJobLevels.forEach((level, i) => {
          queryParams[`level${i}`] = level;
        });
      }

      if (tags && tags.length > 0) {
        query += `
          AND EXISTS (
            SELECT 1 FROM JobPostingsTags jpt
            INNER JOIN JobTags jt ON jpt.tagId = jt.id
            WHERE jpt.jobId = j.id AND jt.tagName IN (${tags
    .map((_, i) => `@tag${i}`)
    .join(', ')})
          )
        `;
        tags.forEach((tag, i) => {
          queryParams[`tag${i}`] = tag;
        });
      }

      const request = new sql.Request();
      Object.entries(queryParams).forEach(([key, value]) => {
        request.input(key, value);
      });

      const result = await request.query(query);
      return result.recordset[0].count;
    } catch (error) {
      console.error('Error in getJobsCount:', error);
      throw error;
    }
  },

  simpleGetJobsCount: async () => {
    try {
      const result = await sql.query`
        SELECT 
          COUNT(*) as totalCount,
          SUM(CASE WHEN CAST(postedDate AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as todayCount
        FROM JobPostings
      `;
      return {
        totalCount: result.recordset[0].totalCount,
        todayCount: result.recordset[0].todayCount
      };
    } catch (error) {
      console.error('Error in simpleGetJobsCount:', error);
      throw error;
    }
  },

  applyForJob: async (userId, jobId) => {
    try {
      const result = await sql.query`
        INSERT INTO user_jobs (user_id, job_id)
        VALUES (${userId}, ${jobId})
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  changeJobStatus: async (userId, jobId, status) => {
    try {
      if (!userId || !jobId || !status) {
        throw new Error('userId, jobId, and status are required');
      }
      
      status = status.toLowerCase();
      if (status !== 'pending' && status !== 'responded' && status !== 'expired') {
        return null;
      }

      const result = await sql.query`
        UPDATE user_jobs
        SET job_status = ${status}
        WHERE user_id = ${userId} AND job_id = ${jobId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  removeJobApplication: async (userId, jobId) => {
    try {
      const result = await sql.query`
        DELETE FROM user_jobs
        WHERE user_id = ${userId} AND job_id = ${jobId}
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getUserAppliedJobs: async (userId) => {
    try {
      const result = await sql.query`
        SELECT 
          j.*,
          uj.applied_at,
          uj.status,
          uj.job_status,
          c.name AS company_name,
          c.logo AS company_logo,
          c.location AS company_location,
          c.description AS company_description,
          c.industry AS company_industry,
          c.size AS company_size,
          c.stock_symbol AS company_stock_symbol,
          c.founded AS company_founded,
          (
            SELECT STRING_AGG(jt.tagName, ', ')
            FROM JobPostingsTags jpt
            INNER JOIN JobTags jt ON jpt.tagId = jt.id
            WHERE jpt.jobId = j.id
          ) AS tags,
          (
            SELECT STRING_AGG(s.name, ', ')
            FROM job_skills js
            INNER JOIN skills s ON js.skill_id = s.id
            WHERE js.job_id = j.id
          ) AS skills
        FROM user_jobs uj
        JOIN JobPostings j ON uj.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE uj.user_id = ${userId}
        ORDER BY uj.applied_at DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getUserAppliedJobsCount: async (userId) => {
    try {
      const result = await sql.query`
        SELECT COUNT(*) as count
        FROM user_jobs
        WHERE user_id = ${userId}
      `;
      return result.recordset[0].count;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },


  getRecentJobCount: async () => {
    try {
      const result = await sql.query(`
        SELECT COUNT(*) AS jobCount
        FROM JobPostings
      `);
      const jobCount = result.recordset[0].jobCount;
      return jobCount;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getJobsByTag: async (tagId, page, pageSize) => {
    try {
      const offset = (page - 1) * pageSize;
  
      const query = `
        SELECT JobPostings.*, 
               companies.name AS company_name, 
               companies.logo AS company_logo, 
               companies.location AS company_location, 
               companies.description AS company_description,
               (
                 SELECT STRING_AGG(JobTags.tagName, ', ')
                 FROM JobPostingsTags
                 INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
                 WHERE JobPostingsTags.jobId = JobPostings.id
               ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.id IN (
          SELECT jobId
          FROM JobPostingsTags
          WHERE tagId = @tagId
        )
        ORDER BY JobPostings.postedDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `;
  
      const result = await sql.query({
        text: query,
        parameters: [
          { name: 'tagId', type: sql.Int, value: tagId },
          { name: 'offset', type: sql.Int, value: offset },
          { name: 'pageSize', type: sql.Int, value: pageSize }
        ]
      });
  
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  getTagId: async (tagName) => {
    try {
      const pool = await sql.connect();

      const jobTagResult = await pool
        .request()
        .input('tagName', sql.NVarChar, tagName)
        .query('SELECT id FROM JobTags WHERE tagName = @tagName');

      if (jobTagResult.recordset.length > 0) {
        return jobTagResult.recordset[0].id;
      }

      return null;
    } catch (err) {
      console.error('Error in getTagId:', err);
      throw err;
    }
  },

  getJobsByTags: async (tags) => {
    try {
      // Convert tags array to a format suitable for SQL IN clause
      const formattedTags = tags
        .map((tag) => `'${tag.replace(/'/g, '\'\'')}'`)
        .join(',');

      const result = await sql.query(`
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
        (
          SELECT STRING_AGG(JobTags.tagName, ', ')
          FROM JobPostingsTags
          INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
          WHERE JobPostingsTags.jobId = JobPostings.id
        ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.id IN (
          SELECT DISTINCT jobId
          FROM JobPostingsTags
          WHERE tagId IN (
            SELECT id FROM JobTags WHERE tagName IN (${formattedTags})
          )
        )
        ORDER BY JobPostings.postedDate DESC
      `);
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getJobsCountByTags: async (tags) => {
    try {
      const tagIds = await Promise.all(
        tags.map(async (tag) => {
          const result = await sql.query`
            SELECT id FROM JobTags WHERE tagName = ${tag}
          `;
          return result.recordset[0].id;
        })
      );

      const result = await sql.query(`
        SELECT COUNT(*) AS count
        FROM JobPostings
        WHERE id IN (
          SELECT jobId
          FROM JobPostingsTags
          WHERE tagId IN (${tagIds.join(',')})
        )
      `);
      return result.recordset[0].count;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  // get jobs with similar tags/skills
  getSimilarJobs: async (jobId) => {
    try {
      const result = await sql.query(`
        WITH OriginalJob AS (
          SELECT id, title FROM JobPostings WHERE id = ${jobId}
        ),
        JobWords AS (
          SELECT DISTINCT value AS word
          FROM OriginalJob
          CROSS APPLY STRING_SPLIT(LOWER(title), ' ')
          WHERE LEN(value) > 2
        ),
        ScoredJobs AS (
          SELECT 
            jp.id,
            jp.title,
            jp.description,
            jp.salary,
            jp.experienceLevel,
            jp.salary_max,
            jp.postedDate,
            jp.location,
            jp.company_id,
            c.name AS company_name, 
            c.logo AS company_logo, 
            c.location AS company_location, 
            c.description AS company_description,
            (
              SELECT STRING_AGG(jt.tagName, ', ') 
              FROM JobPostingsTags jpt
              INNER JOIN JobTags jt ON jpt.tagId = jt.id
              WHERE jpt.jobId = jp.id
            ) AS tags,
            (
              SELECT STRING_AGG(s.name, ', ')
              FROM job_skills js
              INNER JOIN skills s ON js.skill_id = s.id
              WHERE js.job_id = jp.id
            ) AS skills,
            (
              SELECT COUNT(*)
              FROM JobWords
              WHERE CHARINDEX(word, LOWER(jp.title)) > 0
            ) AS word_match_count,
            CASE 
              WHEN jp.title = oj.title THEN 100
              WHEN CHARINDEX(oj.title, jp.title) > 0 OR CHARINDEX(jp.title, oj.title) > 0 THEN 75
              ELSE 0
            END AS exact_match_score
          FROM JobPostings jp
          LEFT JOIN companies c ON jp.company_id = c.id
          CROSS JOIN OriginalJob oj
          WHERE jp.id != oj.id
        )
        SELECT TOP 15 *
        FROM ScoredJobs
        WHERE word_match_count > 0 OR exact_match_score > 0
        ORDER BY (word_match_count + exact_match_score) DESC, postedDate DESC
      `);
  
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  // get jobs with similar tags/skills by the same company
  getSimilarJobsByCompany: async (companyId, jobId) => {
    try {
      const result = await sql.query(`
      SELECT TOP 15
      JobPostings.*,
      companies.name AS company_name,
      companies.logo AS company_logo,
      companies.location AS company_location,
      companies.description AS company_description,
      (
        SELECT STRING_AGG(JobTags.tagName, ', ') 
        FROM JobPostingsTags 
        INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
        WHERE JobPostingsTags.jobId = JobPostings.id
      ) AS tags,
      (
        SELECT STRING_AGG(skills.name, ', ')
        FROM job_skills
        INNER JOIN skills ON job_skills.skill_id = skills.id
        WHERE job_skills.job_id = JobPostings.id
      ) AS skills
    FROM JobPostings
    LEFT JOIN companies ON JobPostings.company_id = companies.id
    WHERE JobPostings.company_id = ${companyId}
      AND JobPostings.id != ${jobId}
      AND JobPostings.id IN (
        SELECT jobId
        FROM JobPostingsTags
        WHERE tagId IN (
          SELECT tagId
          FROM JobPostingsTags
          WHERE jobId = ${jobId}
        )
      )
    ORDER BY JobPostings.postedDate DESC
    
    `);

      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },


  getJobsByCompany: async (companyId, page, pageSize) => {
    try {
      const offset = (page - 1) * pageSize;
      const result = await sql.query`
        SELECT
          JobPostings.*,
          companies.name AS company_name,
          companies.logo AS company_logo,
          companies.location AS company_location,
          companies.description AS company_description,
          (
            SELECT STRING_AGG(JobTags.tagName, ', ') 
            FROM JobPostingsTags 
            INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
            WHERE JobPostingsTags.jobId = JobPostings.id
          ) AS tags,
          (
            SELECT STRING_AGG(skills.name, ', ')
            FROM job_skills
            INNER JOIN skills ON job_skills.skill_id = skills.id
            WHERE job_skills.job_id = JobPostings.id
          ) AS skills
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.company_id = ${companyId}
        ORDER BY JobPostings.postedDate DESC
                OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `;
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCompanies: async () => {
    try {
      const pool = await sql.connect();
      const result = await pool.request().query(`
        SELECT * FROM companies
        ORDER BY name
      `);
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  // function to get the 10 recent job companies 
  // get the most recent 40 job postings
  // and then look at their companies and get the 10 most recent companies
  getRecentCompanies: async () => {
    try {
      const result = await sql.query(`
        WITH RecentCompanies AS (
          SELECT TOP 100
            company_id
          FROM JobPostings
          ORDER BY postedDate DESC
        )
        SELECT TOP 10
          companies.id,
          companies.name,
          companies.logo,
          companies.location,
          companies.description,
          companies.industry,
          companies.size,
          companies.stock_symbol,
          companies.founded,
          ISNULL(job_counts.job_count, 0) AS job_count
        FROM companies
        LEFT JOIN (
          SELECT
            company_id,
            COUNT(*) AS job_count
          FROM JobPostings
          GROUP BY company_id
        ) AS job_counts ON companies.id = job_counts.company_id
        WHERE companies.id IN (SELECT company_id FROM RecentCompanies)
      `);
      const companies = result.recordset;
      return companies;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getSkills: async () => {
    try {
      const result = await sql.query`SELECT * FROM skills`;
      const skills = result.recordset;
      return skills;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  findById: async (id) => {
    try {
      const result = await sql.query`
        SELECT 
          JobPostings.*,
          companies.name AS company_name,
          companies.logo AS company_logo,
          companies.location AS company_location,
          companies.description AS company_description,
          companies.industry AS company_industry,
          companies.size AS company_size,
          companies.stock_symbol AS company_stock_symbol,
          companies.founded AS company_founded,
          users.firstname AS recruiter_firstname,
          users.lastname AS recruiter_lastname,
          users.avatar AS recruiter_image,
          users.username AS recruiter_username,

          (
            SELECT STRING_AGG(JobTags.tagName, ', ') 
            FROM JobPostingsTags 
            INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
            WHERE JobPostingsTags.jobId = JobPostings.id
          ) AS tags,
          (
            SELECT STRING_AGG(skills.name, ', ')
            FROM job_skills
            INNER JOIN skills ON job_skills.skill_id = skills.id
            WHERE job_skills.job_id = JobPostings.id
          ) AS skills
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        LEFT JOIN users ON users.recruiter_id = JobPostings.recruiter_id
        WHERE JobPostings.id = ${id}
      `;
      const job = result.recordset[0];
      return job;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  createJobPosting: async (
    title,
    salary = 0,
    experienceLevel,
    location,
    postedDate = new Date(),
    company_id = 99999,
    link,
    expiration_date = null,
    tags = [],
    description,
    salary_max = null,
    recruiter_id = '1',
    skills = [],
    benefits = [],
    additional_information = '',
    preferredQualifications = '',
    minimumQualifications = '',
    responsibilities = '',
    requirements = '',
    niceToHave = '',
    schedule = '9 - 5',
    hoursPerWeek = 40,
    h1bVisaSponsorship = false,
    isRemote = false,
    equalOpportunityEmployerInfo = '',
    relocation = false,
    isProcessed = 0,
    employmentType = 'Traditional',
    sourcePostingDate = ''
  ) => {
    try {
      const isTechJob = (title) => {
        // Convert title to lowercase for case-insensitive matching
        const lowercaseTitle = title.toLowerCase();
  
        // Highly specific tech roles
        const exactMatches = [
          'software engineer', 'data scientist', 'full stack developer', 'machine learning engineer',
          'devops engineer', 'systems architect', 'systems engineer', 'network engineer', 'data analyst',
          'backend developer', 'frontend developer', 'web developer', 'mobile developer', 'cloud architect',
          'cloud engineer', 'security engineer', 'cybersecurity analyst', 'technical lead', 'tech lead',
          'database administrator', 'qa engineer', 'quality assurance engineer', 'ux designer', 'ui designer',
          'product manager', 'scrum master', 'agile coach', 'site reliability engineer', 'automation engineer',
          'blockchain developer', 'game developer', 'game designer', 'graphic designer', 'systems administrator',
          'it support', 'it specialist', 'it manager', 'technical support', 'technical writer',
          'ai engineer', 'artificial intelligence engineer', 'deep learning engineer', 'data engineer',
          'big data engineer', 'data architect', 'information security analyst', 'robotics engineer',
          'network administrator', 'embedded systems engineer', 'firmware engineer', 'test engineer',
          'software tester', 'business analyst', 'it analyst', 'solution architect', 'enterprise architect',
          'devsecops engineer', 'cloud specialist', 'systems analyst', 'applications engineer',
          'platform engineer', 'release engineer', 'build engineer', 'hardware engineer',
          'electrical engineer', 'electronics engineer', 'microcontroller engineer', 'ios developer',
          'android developer', 'webmaster', 'security analyst', 'information technology specialist',
          'technical consultant', 'pre-sales engineer', 'post-sales engineer', 'technical account manager',
          'computer vision engineer', 'natural language processing engineer', 'nlp engineer',
          'database developer', 'data warehouse engineer', 'etl developer', 'bi developer',
          'business intelligence developer', 'data visualization engineer', 'cloud consultant',
          'solutions engineer', 'integration engineer', 'salesforce developer', 'sap consultant',
          'oracle developer', 'erp consultant', 'crm consultant', 'help desk technician',
          'desktop support technician', 'it technician', '3d artist', 'vr developer', 'ar developer',
          'qa tester', 'quality assurance tester', 'network technician', 'it director', 'cto',
          'chief technology officer', 'cio', 'chief information officer', 'ciso', 'analyst', 'data analyst', 'data scientist', 'data engineer', 'data architect', 'data security analyst', 'chief information security officer', 'coordinator', 
          'chief information security officer', 'coordinator', 'director', 'manager', 'supervisor', 'associate', 'customer experience', 'customer service', 'technical writer', 'technical support', 'it analyst', 'it specialist', 'it manager', 'information security analyst', 'information security manager', 'security analyst', 'security manager', 'security specialist', 'security engineer', 'security architect', 'security consultant', 'security director', 'security officer', 'security supervisor', 'security technician', 'security analyst', 'security manager', 'security specialist', 'security engineer', 'security architect', 'security consultant', 'security director', 'security officer', 'security supervisor', 'security technician',
          'people manager', 'hr', 'account executive', 'social media manager', 'biostatistician', 'financial analyst', 'statistical programmer', 'programmer', 'trading intern', 'trading analyst', 'trading assistant', 'trading manager', 'trading specialist', 'trading engineer', 'trading architect', 'trading consultant', 'trading director', 'trading officer', 'trading supervisor', 'trading technician', 'trading analyst', 'trading assistant', 'trading manager', 'trading specialist', 'trading engineer', 'trading architect', 'trading consultant', 'trading director', 'trading officer', 'trading supervisor', 'trading technician', 'quantitative researcher', 'quantitative analyst', 'quantitative manager', 'quantitative specialist', 'quantitative engineer', 'quantitative architect', 'quantitative consultant', 'quantitative director', 'quantitative officer', 'quantitative supervisor', 'quantitative technician',
          'risk strategist', 'head of revenue', 'head of kyc', 'vp of design', 'security engineer', 'project manager', 'product manager', 'product designer', 'computer science intern', 'business development', 'growth lead', 'code sme', 'head of growth,', 'sales developmet', 'head of recruiting',
          'customer service', 'editor', 'content editor', 'content writer', 'content strategist', 'content manager', 'content director', 'content officer', 'content supervisor', 'content technician', 'content analyst', 'content specialist', 'content engineer', 'content architect', 'content consultant', 'content director', 'content officer', 'content supervisor', 'content technician', 'content analyst', 'content specialist', 'content engineer', 'content architect', 'content consultant', 'content director', 'content officer', 'content supervisor', 'content technician', 'content analyst', 'content specialist', 'content engineer', 'content architect', 'content consultant',
          'customer support representative', 'salesforce'
        ];

        const noInclude = [
          'cashier', 'cook', 'waitress', 'waiter', 'bartender', 'janitor', 'security guard',
        ];

        // Function to create regex patterns for exact matches and keywords
        const createPattern = (words) => new RegExp(`\\b(${words.join('|')})\\b`, 'i');

        const techPattern = createPattern(exactMatches);
        const nonTechPattern = createPattern(noInclude);

        // If title matches a non-tech engineering role, return false
        if (nonTechPattern.test(lowercaseTitle)) {
          return false;
        }

        // If title matches a tech role, return true
        if (techPattern.test(lowercaseTitle)) {
          return true;
        }

        // List of generic tech-related keywords
        const techKeywords = [
          'developer', 'designer', 'analytics', 'engineering', 'programmer', 'engineer', 'software', 'hardware', 'technology', 'technician',
          'administrator', 'analyst', 'architect', 'consultant', 'specialist', 'support', 'coder',
          'tester', 'manager', 'devops', 'cloud', 'data', 'ai', 'artificial intelligence',
          'machine learning', 'ml', 'blockchain', 'crypto', 'cybersecurity', 'security', 'database',
          'web', 'mobile', 'ios', 'android', 'ux', 'ui', 'qa', 'quality assurance', 'sre',
          'automation', 'product', 'agile', 'scrum', 'network', 'system', 'systems', 'it',
          'information technology', 'digital', 'full stack', 'front end', 'backend', 'back end',
          'saas', 'paas', 'big data', 'data science', 'devsecops', 'nlp', 'natural language processing',
          'vr', 'ar', 'virtual reality', 'augmented reality', 'robotics', 'embedded', 'firmware',
          'microcontroller', 'fpga', 'simulation', 'cloud computing', 'docker', 'kubernetes',
          'container', 'microservices', 'serverless', 'distributed systems', 'e-commerce', 'ecommerce',
          'internet', 'digital transformation', 'iot', 'internet of things', 'opensource', 'open source',
          'technical', 'computing', 'computational', 'scientist', 'quantitative', 'researcher', 'analyst', 'coder',
        ];

        const techKeywordsPattern = createPattern(techKeywords);

        // If title contains any tech keywords, return true
        if (techKeywordsPattern.test(lowercaseTitle)) {
          return true;
        }

        // If none of the above conditions are met, it's likely not a tech job
        return false;
      };  

      if (typeof link !== 'string') {
        throw new Error('Link must be a string');
      }

      // check if type of salary, and salary_max is a string, if so attempt to convert to int fail to 0
      if (typeof salary === 'string') {
        salary = parseInt(salary) || 0;
      }
      if (typeof salary_max === 'string') {
        salary_max = parseInt(salary_max) || 0;
      }

      if (typeof title !== 'string') {
        throw new Error('Title must be a string');
      }

      if (!isTechJob(title)) {
        console.log('Not a tech job, not inserting.');
        return null;
      }

      skills = Array.isArray(skills)
        ? skills
        : typeof skills === 'string'
          ? skills.split(',').map((skill) => skill.trim())
          : [];
      tags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
          ? tags.split(',').map((tag) => tag.trim())
          : [];

      let benefitsArray = [];
      if (Array.isArray(benefits)) {
        benefitsArray = benefits;
      } else if (typeof benefits === 'string') {
        benefitsArray = benefits.split(',').map((benefit) => benefit.trim());
      } else if (benefits) {
        console.warn('Unexpected benefits format. Using empty array.');
      }

      // Format the benefits array for SQL query
      const formattedBenefits = benefitsArray
        .map((benefit) => `'${benefit.replace(/'/g, '\'\'')}'`)
        .join(',');

      // check if link already in database
      const linkExists = await utilFunctions.checkForDuplicateLink(link);
      if (linkExists) {
        console.log('Link already exists in database, not inserting.');
        return {error: 'Link already exists in database, not inserting.'};
      }

      let jobPostingId;
      try {
        // Insert the job posting into the JobPostings table
        const result = await sql.query`
          INSERT INTO JobPostings (
            title,
            salary,
            experienceLevel,
            location,
            postedDate,
            company_id,
            link,
            expiration_date,
            description,
            salary_max,
            recruiter_id,
            additional_information,
            benefits,
            preferredQualifications,
            minimumQualifications,
            responsibilities,
            requirements,
            niceToHave,
            schedule,
            hoursPerWeek,
            h1bVisaSponsorship,
            isRemote,
            equalOpportunityEmployerInfo,
            relocation,
            applicants,
            isProcessed,
            employmentType,
            sourcePostingDate
          )
          OUTPUT INSERTED.id
          VALUES (
            ${title},
            ${salary},
            ${experienceLevel},
            ${location},
            ${postedDate},
            ${company_id},
            ${link},
            ${expiration_date},
            ${description},
            ${salary_max},
            ${recruiter_id},
            ${additional_information},
            ${formattedBenefits},
            ${preferredQualifications},
            ${minimumQualifications},
            ${responsibilities},
            ${requirements},
            ${niceToHave},
            ${schedule},
            ${hoursPerWeek},
            ${h1bVisaSponsorship},
            ${isRemote},
            ${equalOpportunityEmployerInfo},
            ${relocation},
            0,
            ${isProcessed},
            ${employmentType},
            ${sourcePostingDate}
          )
        `;
        jobPostingId = result.recordset[0].id;
      } catch (err) {
        console.error(`Error inserting job posting: ${err.message}`);
        throw err;
      }

      if (skills && skills.length > 0) {
        for (const skill of skills) {
          try {
            let skillId;
            const skillRecord = await sql.query`
              SELECT id FROM skills WHERE name = ${skill}
            `;
            if (skillRecord.recordset.length > 0) {
              skillId = skillRecord.recordset[0].id;
            } else {
              const newSkill = await sql.query`
                INSERT INTO skills (name)
                OUTPUT INSERTED.id
                VALUES (${skill})
              `;
              skillId = newSkill.recordset[0].id;
            }

            // Associate the skill with the job posting
            await sql.query`
              INSERT INTO job_skills (job_id, skill_id)
              VALUES (${jobPostingId}, ${skillId})
            `;
          } catch (err) {
            console.error(`Error processing skill '${skill}': ${err.message}`);
            throw err;
          }
        }
      }

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          try {
            let tagId;
            const tagRecord = await sql.query`
              SELECT id FROM JobTags WHERE tagName = ${tag}
            `;
            if (tagRecord.recordset.length > 0) {
              tagId = tagRecord.recordset[0].id;
            } else {
              const newTag = await sql.query`
                INSERT INTO JobTags (tagName)
                OUTPUT INSERTED.id
                VALUES (${tag})
              `;
              tagId = newTag.recordset[0].id;
            }

            // Associate the tag with the job posting
            await sql.query`
              INSERT INTO JobPostingsTags (jobId, tagId)
              VALUES (${jobPostingId}, ${tagId})
            `;
          } catch (err) {
            console.error(`Error processing tag '${tag}': ${err.message}`);
            throw err;
          }
        }
      }

      return jobPostingId;
    } catch (err) {
      console.log(
        `Error creating job posting with information: ${title}, ${salary}, ${experienceLevel}, ${location}, ${postedDate}, ${company_id}, ${link}, ${expiration_date}, ${tags}, ${description}, ${salary_max}, ${recruiter_id}, ${skills}, ${benefits}, ${additional_information}, ${preferredQualifications}, ${minimumQualifications}, ${responsibilities}, ${requirements}, ${niceToHave}, ${schedule}, ${hoursPerWeek}, ${h1bVisaSponsorship}, ${isRemote}, ${equalOpportunityEmployerInfo}, ${relocation}`
      );
      console.error(
        `Database insert error: ${err.message} in createJobPosting`
      );
      throw err; // Rethrow the error for the caller to handle
    }
  },

  searchSkills: async (searchTerm) => {
    try {
      const result = await sql.query`
        SELECT TOP 5 s.name, s.id, COUNT(js.job_id) AS job_count
        FROM skills s
        LEFT JOIN job_skills js ON s.id = js.skill_id
        WHERE s.name LIKE ${searchTerm + '%'}
        GROUP BY s.name, s.id
        ORDER BY job_count DESC, s.name
      `;
      return result.recordset.map(record => ({
        name: record.name,
        id: record.id,
        jobCount: record.job_count
      }));
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCompanyByName: async (name) => {
    try {
      const result = await sql.query`
        SELECT TOP 1 * FROM companies WHERE name = ${name}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCompanyById: async (id) => {
    try {
      const result = await sql.query`
        SELECT * FROM companies WHERE id = ${id}
      `;
      return result.recordset[0];
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  getCompanyIdByName: async (name) => {
    try {
      // Normalize the input name
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9&]/g, '');
  
      // Define the minimum length for partial matching
      const MIN_PARTIAL_LENGTH = 3;
  
      // First, try to find an exact match
      const exactMatchResult = await sql.query`
        SELECT TOP 1 
          c.id, 
          c.name, 
          c.logo, 
          c.location, 
          c.description, 
          c.industry, 
          c.size, 
          c.stock_symbol, 
          c.founded,
          COUNT(jp.id) as job_count
        FROM companies c
        LEFT JOIN JobPostings jp ON c.id = jp.company_id
        WHERE
          dbo.NormalizeCompanyName(c.name) = ${normalizedName}
          OR (
            dbo.NormalizeCompanyName(c.name) LIKE '%' + ${normalizedName} + '%'
            AND LEN(${normalizedName}) >= ${MIN_PARTIAL_LENGTH}
          )
        GROUP BY 
          c.id, c.name, c.logo, c.location, 
          c.description, c.industry, c.size, 
          c.stock_symbol, c.founded
        ORDER BY job_count DESC
      `;
      if (exactMatchResult.recordset.length > 0) {
        return exactMatchResult.recordset[0];
      }
  
      // If no exact match, try partial matches with stricter conditions
      const partialMatchResult = await sql.query`
        SELECT TOP 5 
          c.id, 
          c.name, 
          c.logo, 
          c.location, 
          c.description, 
          c.industry, 
          c.size, 
          c.stock_symbol, 
          c.founded,
          COUNT(jp.id) as job_count,
          LEN(c.name) as name_length,
          LEN(${normalizedName}) as input_length
        FROM companies c
        LEFT JOIN JobPostings jp ON c.id = jp.company_id
        WHERE 
          (
            /* Match if the normalized company name contains the input */
            LOWER(REPLACE(c.name, ' ', '')) LIKE '%' + ${normalizedName} + '%'
            /* Or if the input contains the normalized company name, 
               but only if the company name is at least 5 characters long */
            OR (
              ${normalizedName} LIKE '%' + LOWER(REPLACE(c.name, ' ', '')) + '%'
              AND LEN(REPLACE(c.name, ' ', '')) >= 5
            )
          )
          /* Ensure the input name meets the minimum length for partial matching */
          AND LEN(${normalizedName}) >= ${MIN_PARTIAL_LENGTH}
        GROUP BY 
          c.id, c.name, c.logo, c.location, 
          c.description, c.industry, c.size, 
          c.stock_symbol, c.founded
        HAVING 
          /* Ensure the match is at least 50% of the longer string's length */
          LEN(LOWER(REPLACE(c.name, ' ', ''))) >= 0.5 * 
            CASE 
              WHEN LEN(${normalizedName}) > LEN(LOWER(REPLACE(c.name, ' ', ''))) 
                THEN LEN(${normalizedName}) 
              ELSE LEN(LOWER(REPLACE(c.name, ' ', ''))) 
            END
        ORDER BY 
          CASE 
            WHEN LOWER(REPLACE(c.name, ' ', '')) = ${normalizedName} THEN 1
            WHEN LOWER(REPLACE(c.name, ' ', '')) LIKE ${normalizedName} + '%' THEN 2
            WHEN LOWER(REPLACE(c.name, ' ', '')) LIKE '%' + ${normalizedName} + '%' THEN 3
            WHEN ${normalizedName} LIKE '%' + LOWER(REPLACE(c.name, ' ', '')) + '%' THEN 4
            ELSE 5
          END,
          COUNT(jp.id) DESC,
          ABS(LEN(LOWER(REPLACE(c.name, ' ', ''))) - LEN(${normalizedName})) ASC
      `;
      if (partialMatchResult.recordset.length > 0) {
        return partialMatchResult.recordset[0];
      }
  
      // If still no match, return null
      return null;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  

  createCompany: async (
    name,
    logo_url,
    location,
    job_board_url,
    description,
    industry,
    size,
    stock_symbol,
    founded
  ) => {
    try {
      const result = await sql.query`
        INSERT INTO companies (name, logo, location, description, job_board_url, industry, size, stock_symbol, founded)
        OUTPUT INSERTED.id
        VALUES (${name}, ${logo_url}, ${location}, ${description}, ${job_board_url}, ${industry}, ${size}, ${stock_symbol}, ${founded})
      `;
      const companyObject = result.recordset[0];
      return companyObject;
    } catch (err) {
      console.error(`Database insert error: ${err} in createCompany`);
      throw err;
    }
  },
  deleteJob: async (jobId) => {
    try {
      await sql.query`
        DELETE FROM JobPostingsTags WHERE jobId = ${jobId}
      `;
      await sql.query`
      DELETE FROM user_jobs WHERE job_id = ${jobId}
    `;
      await sql.query`
        DELETE FROM job_skills WHERE job_id = ${jobId}
      `;
      await sql.query`
      DELETE FROM JobPostings WHERE id = ${jobId}
    `;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  

  automatedDeleteJob: async (jobId) => {
    try {
      await sql.query`
        DELETE FROM JobPostingsTags WHERE jobId = ${jobId}
      `;
      await sql.query`
        DELETE FROM job_skills WHERE job_id = ${jobId}
      `;
      await sql.query`
      DELETE FROM JobPostings WHERE id = ${jobId}
    `;
    
      console.log(`Deleted job with ID ${jobId}`);

    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  mergeJobs: async (primaryJobId, duplicateJobId) => {
    try {

      // Update applied jobs
      await sql.query`
          UPDATE user_jobs
          SET job_id = ${primaryJobId}
          WHERE job_id = ${duplicateJobId}
        `;
      
      // Delete the duplicate job from related tables
      await sql.query`
          DELETE FROM JobPostingsTags WHERE jobId = ${duplicateJobId}
          DELETE FROM job_skills WHERE job_id = ${duplicateJobId}
          DELETE FROM JobPostings WHERE id = ${duplicateJobId}
        `;
  
      console.log(`Merged job ${duplicateJobId} into ${primaryJobId}`);
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getDuplicateJobPostings: async () => {
    try {
      const result = await sql.query(`
        SELECT id, title, company_id, salary
        FROM JobPostings
        WHERE (title, company_id, salary, location) IN (
          SELECT title, company_id, salary, location
          FROM JobPostings
          GROUP BY title, company_id, salary, location
          HAVING COUNT(*) > 1
        )
        ORDER BY title, company_id, salary, postedDate DESC
      `);
      
      // Group the results
      const groupedResults = result.recordset.reduce((acc, job) => {
        const key = `${job.title}-${job.company_id}-${job.salary}-${job.location}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(job);
        return acc;
      }, {});
  
      return Object.values(groupedResults);
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  // return list of ids of jobs that are older than 60 days
  getOldJobs: async () => {
    try {
      const result = await sql.query(`
        SELECT id
        FROM JobPostings
        WHERE postedDate < DATEADD(day, -60, GETDATE())
      `);
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getCountOfTopJobTags: async () => {
    try {
      const result = await sql.query`
        SELECT TOP 30 tagName, COUNT(tagId) AS count
        FROM JobPostingsTags
        INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
        GROUP BY tagId, tagName
        ORDER BY count DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error in getCountOfTopJobTags:', err);
      throw err;
    }
  },

  getCountOfTopJobSkills: async () => {
    try {
      const result = await sql.query`
        SELECT TOP 30 skills.name, COUNT(skill_id) AS count, skills.id
        FROM job_skills
        INNER JOIN skills ON job_skills.skill_id = skills.id
        GROUP BY skill_id, skills.name, skills.id
        ORDER BY count DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error('Database query error in getCountOfTopJobSkills:', err);
      throw err;
    }
  },


  getCountOfTopJobTagsByCompany: async (companyId) => {
    try {
      const result = await sql.query`
        SELECT TOP 30 tagName, COUNT(tagId) AS count
        FROM JobPostingsTags
        INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
        WHERE jobId IN (
          SELECT id FROM JobPostings WHERE company_id = ${companyId}
        )
        GROUP BY tagId, tagName
        ORDER BY count DESC
      `;
      return result.recordset;
    } catch (err) {
      console.error(
        'Database query error in getCountOfTopJobTagsByCompany:',
        err
      );
      throw err;
    }
  },


  getUserJobExperience: async (userId) => {
    try {
      const result = await sql.query`
        SELECT 
          je.id,
          je.userId,
          je.title,
          je.startDate,
          je.isCurrent,
          je.employmentHours,
          je.tags,
          je.endDate,
          je.description,
          je.employmentType,
          je.companyName AS userEnteredCompanyName,
          CASE 
            WHEN c.name IS NULL THEN je.companyName
            ELSE c.name
          END AS companyName,
          c.logo AS companyLogo
        FROM job_experiences je
        LEFT JOIN companies c ON 
          LOWER(TRIM(je.companyName)) = LOWER(TRIM(c.name))
          OR (
            LEN(je.companyName) > 3 
            AND (
              LOWER(TRIM(je.companyName)) LIKE LOWER(TRIM(c.name)) + ' %'
              OR LOWER(TRIM(c.name)) LIKE LOWER(TRIM(je.companyName)) + ' %'
              OR LOWER(TRIM(je.companyName)) LIKE '% ' + LOWER(TRIM(c.name))
              OR LOWER(TRIM(c.name)) LIKE '% ' + LOWER(TRIM(je.companyName))
            )
          )
        WHERE je.userId = ${userId}
      `;
  
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getUserEducationExperience: async (userId) => {
    try {
      const result = await sql.query`
        SELECT * FROM education_experiences WHERE userId = ${userId}
      `;

      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  clearUserJobExperience: async (userId) => {
    try {
      await sql.query`
        DELETE FROM job_experiences WHERE userId = ${userId}
      `;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  clearUserEducationExperience: async (userId) => {
    try {
      await sql.query`
        DELETE FROM education_experiences WHERE userId = ${userId}
      `;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  clearUserJobExperienceTags: async (userId) => {
    try {
      await sql.query`
        DELETE FROM job_experiences_tags WHERE experienceId IN (
          SELECT id FROM job_experiences WHERE userId = ${userId}
        )
      `;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  addJobExperience: async (
    userId,
    title,
    employmentType,
    companyName,
    location,
    isCurrent,
    startDate,
    endDate,
    description,
    tags
  ) => {
    try {
      const result = await sql.query`
        INSERT INTO job_experiences (userId, title, employmentType, companyName, isCurrent, location, startDate, endDate, description, tags)
        OUTPUT INSERTED.id
        VALUES (${userId}, ${title}, ${employmentType}, ${companyName}, ${isCurrent}, ${location}, ${startDate}, ${endDate}, ${description}, ${tags})
      `;

      const newExperienceId = result.recordset[0].id;
      return newExperienceId;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  /* 
  CREATE TABLE education_experiences (
    id INT PRIMARY KEY IDENTITY(1,1),
    userId NVARCHAR(255) NOT NULL,
    institutionName NVARCHAR(255) NOT NULL,
    degree NVARCHAR(255) NULL,
    fieldOfStudy NVARCHAR(255) NULL,
    startDate DATE NULL,
    endDate DATE NULL,
    isCurrent BIT NOT NULL DEFAULT 0,
    grade NVARCHAR(50) NULL,
    activities NVARCHAR(255) NULL,
    description NVARCHAR(MAX) NULL
);
*/

  addEducationExperience: async (
    userId,
    institutionName,
    degree,
    fieldOfStudy,
    isCurrent,
    startDate,
    endDate = null,
    description,
    grade = null,
    activities
  ) => {
    try {
      const result = await sql.query`
        INSERT INTO education_experiences (userId, institutionName, degree, fieldOfStudy, startDate, endDate, isCurrent, grade, activities, description)
        OUTPUT INSERTED.id
        VALUES (${userId}, ${institutionName}, ${degree}, ${fieldOfStudy}, ${startDate}, ${endDate}, ${isCurrent}, ${grade}, ${activities}, ${description})
      `;

      const newExperienceId = result.recordset[0].id;
      return newExperienceId;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getAllCompaniesAndJobCount: async () => {
    try {
      const result = await sql.query`
      SELECT companies.id, companies.name, companies.logo, companies.location, companies.description, companies.industry, companies.size, companies.stock_symbol, companies.founded, COUNT(JobPostings.id) AS jobCount
      FROM companies
      LEFT JOIN JobPostings ON companies.id = JobPostings.company_id AND JobPostings.deleted = 0
      GROUP BY companies.id, companies.name, companies.logo, companies.location, companies.description, companies.industry, companies.size, companies.stock_symbol, companies.founded
      ORDER BY companies.name
    `;

      return result.recordset;

    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getJobsByState: async (state) => {
    try {
      const stateMappings = {
        Alabama: 'AL',
        Alaska: 'AK',
        Arizona: 'AZ',
        Arkansas: 'AR',
        California: 'CA',
        Colorado: 'CO',
        Connecticut: 'CT',
        Delaware: 'DE',
        Florida: 'FL',
        Georgia: 'GA',
        Hawaii: 'HI',
        Idaho: 'ID',
        Illinois: 'IL',
        Indiana: 'IN',
        Iowa: 'IA',
        Kansas: 'KS',
        Kentucky: 'KY',
        Louisiana: 'LA',
        Maine: 'ME',
        Maryland: 'MD',
        Massachusetts: 'MA',
        Michigan: 'MI',
        Minnesota: 'MN',
        Mississippi: 'MS',
        Missouri: 'MO',
        Montana: 'MT',
        Nebraska: 'NE',
        Nevada: 'NV',
        'New Hampshire': 'NH',
        'New Jersey': 'NJ',
        'New Mexico': 'NM',
        'New York': 'NY',
        'North Carolina': 'NC',
        'North Dakota': 'ND',
        Ohio: 'OH',
        Oklahoma: 'OK',
        Oregon: 'OR',
        Pennsylvania: 'PA',
        'Rhode Island': 'RI',
        'South Carolina': 'SC',
        'South Dakota': 'SD',
        Tennessee: 'TN',
        Texas: 'TX',
        Utah: 'UT',
        Vermont: 'VT',
        Virginia: 'VA',
        Washington: 'WA',
        'West Virginia': 'WV',
        Wisconsin: 'WI',
        Wyoming: 'WY',
        'United States': 'US',
      };

      const fullStateName =
        Object.keys(stateMappings).find(
          (key) => stateMappings[key] === state
        ) || state;
      const stateAbbreviation = stateMappings[state] || state;

      const query = `
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
        (
          SELECT STRING_AGG(JobTags.tagName, ', ')
          FROM JobPostingsTags
          INNER JOIN JobTags ON JobPostingsTags.tagId = JobTags.id
          WHERE JobPostingsTags.jobId = JobPostings.id
        ) AS tags
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.location LIKE '%${fullStateName}%' 
           OR JobPostings.location LIKE '% ${stateAbbreviation}%'
        ORDER BY JobPostings.postedDate DESC
      `;

      console.log('SQL Query: ', query);

      const result = await sql.query(query);

      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getSkillsId: async (skillName) => {
    try {
      const jobTagResult = await sql.query`
        SELECT id FROM skills WHERE name LIKE '%' + ${skillName} + '%'
      `;

      if (jobTagResult.recordset.length > 0) {
        return jobTagResult.recordset[0].id;
      }

      return null;
    } catch (err) {
      console.error('Error in getTagId:', err);
      throw err;
    }
  },

  getSimilarSkills: async (skillId) => {
    try {
      const result = await sql.query(`
        SELECT TOP 9 s.name, COUNT(*) as skill_count
        FROM job_skills js
        JOIN skills s ON js.skill_id = s.id
        WHERE js.job_id IN (
          SELECT job_id
          FROM job_skills
          WHERE skill_id = '${skillId}'
        )
        AND js.skill_id != '${skillId}'
        GROUP BY s.id, s.name
        ORDER BY skill_count DESC
      `);
  
      return result.recordset;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },

  getJobsBySkills: async (skillId, page = 1, pageSize = 15) => {
    try {
      const offset = (page - 1) * pageSize;
      const result = await sql.query(`
        SELECT JobPostings.*, companies.name AS company_name, companies.logo AS company_logo, companies.location AS company_location, companies.description AS company_description,
(
  SELECT STRING_AGG(skills.name, ', ') WITHIN GROUP (ORDER BY skills.name)
  FROM job_skills
  INNER JOIN skills ON job_skills.skill_id = skills.id
  WHERE job_skills.job_id = JobPostings.id
) AS skills
        FROM JobPostings
        LEFT JOIN companies ON JobPostings.company_id = companies.id
        WHERE JobPostings.id IN (
          SELECT job_id
          FROM job_skills
          WHERE skill_id = '${skillId}'
        )
        ORDER BY JobPostings.postedDate DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `);
  
      const jobs = result.recordset;
      return jobs;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
};

module.exports = jobQueries;
