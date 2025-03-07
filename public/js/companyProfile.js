// Declare these variables in the global scope
let currentPage = 1;
const pageSize = 15;
let isLoading = false;
let hasMoreJobs = true;

if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    const companyProfileButtons = document.querySelectorAll(
      ".company-navbar-button",
    );
    const companyProfileSections = document.querySelectorAll(
      ".company-profile-section",
    );

    companyProfileButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const targetId = button.getAttribute("data-id");

        companyProfileSections.forEach((section) => {
          if (section.className.includes(targetId)) {
            section.style.display = "block";
          } else {
            section.style.display = "none";
          }
        });

        // Update active button state (optional)
        companyProfileButtons.forEach((btn) => {
          btn.classList.remove("active");
        });
        button.classList.add("active");
      });
    });
    const description = document.querySelector(".description-text");
    const showMoreButton = document.querySelector(".show-more-button");
    const descriptionContainer = document.querySelector(".company-description");

    if (description && showMoreButton) {
      if (description.scrollHeight > description.clientHeight) {
        showMoreButton.style.display = "block";
      }

      showMoreButton.addEventListener("click", () => {
        if (description.style.maxHeight === "none") {
          description.style.maxHeight = "100px";
          descriptionContainer.style.maxHeight = "3.4rem";
          showMoreButton.innerText = "Show More";
        } else {
          descriptionContainer.style.maxHeight = "none";
          description.style.maxHeight = "none";
          showMoreButton.innerText = "Show Less";
        }
      });
    }

    const companyNameMeta = document.querySelector('meta[name="company-name"]');
    if (companyNameMeta) {
      const companyName = companyNameMeta.content;
      loadCompanyJobs(companyName);

      // Add scroll event listener for infinite scrolling
      window.addEventListener("scroll", () => {
        if (
          window.innerHeight + window.scrollY >=
            document.body.offsetHeight - 500 &&
          !isLoading &&
          hasMoreJobs
        ) {
          loadCompanyJobs(companyName);
        }
      });
    }
  });
}

async function loadCompanyJobs(companyName) {
  if (isLoading || !hasMoreJobs) {
    return;
  }
  isLoading = true;

  try {
    if (isLoading) {
      const loadingSpinner = document.querySelector("#loading-indicator");
      if (loadingSpinner) {
        loadingSpinner.style.display = "block";
        const jobListContainer = document.querySelector(".job-list");
        jobListContainer.appendChild(loadingSpinner);
      }
    } else {
      const loadingSpinner = document.querySelector("#loading-indicator");
      if (loadingSpinner) {
        loadingSpinner.style.display = "none";
      }
    }

    const response = await fetch(
      `/api/jobs/company/${encodeURIComponent(companyName)}?page=${currentPage}&pageSize=${pageSize}`,
    );
    const jobs = await response.json();

    if (jobs.length === 0) {
      hasMoreJobs = false;
      isLoading = false;
      // hide loading indicator and display 'end of the list message'
      const loadingSpinner = document.querySelector("#loading-indicator");
      if (loadingSpinner) {
        loadingSpinner.style.display = "none";
      }
      const jobListContainer = document.querySelector(".job-list");
      const endOfListMessage = document.createElement("div");
      endOfListMessage.classList.add("end-of-list-message");
      endOfListMessage.classList.add("text-muted-foreground");
      endOfListMessage.classList.add("mini-text");
      endOfListMessage.classList.add("flex");
      endOfListMessage.classList.add("h-center");
      endOfListMessage.textContent = "No more job postings to display";
      jobListContainer.appendChild(endOfListMessage);
    } else {
      renderJobPostings(jobs);
      currentPage++;
    }
  } catch (error) {
    console.error("Error fetching jobs:", error);
  } finally {
    isLoading = false;
  }
}

function formatDateColor(dateString) {
  const now = new Date();
  const postedDate = new Date(dateString);
  // if within 2 weeks, green, if within 2 months, yellow, if older, red
  const diffTime = Math.abs(now - postedDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 14) {
    return "green";
  } else if (diffDays <= 60) {
    return "yellow";
  } else {
    return "red";
  }
}

function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInSeconds < 172800) {
    return "1d ago";
  } else {
    const month = date.toLocaleString("default", { month: "short" });
    const day = String(date.getDate());
    const year = date.getFullYear();
    const currentYear = now.getFullYear();

    if (year === currentYear) {
      return `${month} ${day}`;
    } else {
      return `${month} ${day}, ${year}`;
    }
  }
}

function getTintFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 18) - hash);
  }
  const color = (hash & 0x00ffffff).toString(16).toUpperCase();
  const tintColor = `#${color}`;
  return tintColor;
}

document.addEventListener("DOMContentLoaded", function () {
  const stockSymbols = document.querySelectorAll(".company-stock_symbol");

  stockSymbols.forEach((symbolElement) => {
    const symbol = symbolElement.dataset.symbol;
    if (symbol) {
      fetchStockMovement(symbol, symbolElement);
    }
  });
});

async function fetchStockMovement(symbol, element) {
  const API_KEY = "YOUR_ALPHA_VANTAGE_API_KEY_HERE"; // Replace with your actual API key
  const API_URL = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;

  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    if (data["Global Quote"]) {
      const changePercent = parseFloat(
        data["Global Quote"]["10. change percent"].replace("%", ""),
      );
      updateStockMovement(element, changePercent);
    }
  } catch (error) {
    console.error("Error fetching stock data:", error);
  }
}

function updateStockMovement(element, changePercent) {
  const movementElement = element.querySelector(".stock-movement");
  if (movementElement) {
    const formattedChange = changePercent.toFixed(2);
    const sign = changePercent >= 0 ? "+" : "";
    movementElement.textContent = `${sign}${formattedChange}%`;
    movementElement.classList.add(changePercent >= 0 ? "positive" : "negative");
  }
}

function formatLocation(location) {
  if (location === "N/A") {
    return "Remote";
  }

  const parts = location.split(",").map((part) => part.trim());

  // Helper function to check if a string is a US state
  const isUSState = (str) =>
    Object.keys(stateMappings).includes(str) ||
    Object.values(stateMappings).includes(str);

  // Helper function to get state abbreviation
  const getStateAbbr = (state) => {
    const fullName = Object.keys(stateMappings).find(
      (key) => key.toLowerCase() === state.toLowerCase(),
    );
    return fullName ? stateMappings[fullName] : state;
  };

  // Helper function to get country abbreviation
  const getCountryAbbr = (country) => {
    const fullName = Object.keys(countryMappings).find(
      (key) => key.toLowerCase() === country.toLowerCase(),
    );
    return fullName ? countryMappings[fullName] : country;
  };

  // Helper function to format a single location
  const formatSingleLocation = (city, state, country) => {
    const isRemote =
      city.toLowerCase() === "remote" || city.toLowerCase() === "n/a";

    if (country && country !== "N/A") {
      const countryAbbr = getCountryAbbr(country);
      if (
        countryAbbr.toLowerCase() === "usa" ||
        country.toLowerCase() === "united states" ||
        country.toLowerCase() === "us"
      ) {
        if (isRemote) {
          return "Remote, USA";
        } else {
          return `${city !== "N/A" ? city + ", " : ""}${state !== "N/A" ? getStateAbbr(state) : "USA"}`;
        }
      } else {
        if (isRemote) {
          return "Remote, " + countryAbbr;
        } else {
          return `${city !== "N/A" ? city : ""}${state !== "N/A" && state !== city ? "/" + getStateAbbr(state) : ""}, ${countryAbbr}`;
        }
      }
    } else if (state && state !== "N/A") {
      return `${isRemote ? "Remote, " : ""}${isUSState(state) ? getStateAbbr(state) : state}`;
    } else if (city && city !== "N/A") {
      return city;
    } else {
      return "Remote";
    }
  };

  // Process multiple locations
  const locations = [];
  for (let i = 0; i < parts.length; i += 3) {
    const city = parts[i];
    const state = parts[i + 1] || "";
    const country = parts[i + 2] || "";

    try {
      locations.push(formatSingleLocation(city, state, country));
    } catch (error) {
      console.error("Error formatting location:", error);
    }
  }

  return locations.join("; ");
}

function extractSalaryFromDescription(description) {
  const salaryPatterns = [
    // 1. Match salary ranges like "$144,000 - $203,500" or "$120,000.00 - $178,000.00"
    /\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s?[-—]\s?\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/gi,

    // 2. Match salary ranges like "CAD $108,100 - CAD $199,700"
    /(?:CAD\s?\$)\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s?[-—]\s?(?:CAD\s?\$)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/gi,

    // 3. Match ranges with USD, e.g., "106,100 - 185,400 USD per year"
    /(?:USD\s?)?\$?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s?[-—]\s?(?:USD\s?)?\$?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s?(?:per year|per month|per hour)?/gi,

    // 4. Flexible range with at least one currency indicator, e.g., "148,000 - 276,000 USD"
    /\$([0-9]{1,3}(?:,[0-9]{3})*)\s?(?:USD|CAD)\s?[-—]\s?\$([0-9]{1,3}(?:,[0-9]{3})*)\s?(?:USD|CAD)/gi,

    // 5. Match individual salaries like "$45 /hr", "$100,000 USD"
    /\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s?(?:USD|CAD)?\s?(?:\/mo|\/hr|\s*hour|\s*month)/gi,

    // 6. Match compact salary ranges like "CA$125K - CA$160K"
    /(?:CA\$|USD\s?)?([0-9]{1,3}(?:[KMB]))\s?[-—]\s?(?:CA\$|USD\s?)?([0-9]{1,3}(?:[KMB]))/gi,

    // 7. Added pattern for hourly rates like "18 USD - 71 USD per hour" with at least one currency indicator
    /([0-9]{2,}(?:,[0-9]{3})?)\s?(?:USD|CAD)\s?[-—]\s?([0-9]{2,}(?:,[0-9]{3})?)\s?(?:USD|CAD)\s?(?:per hour|\/hr|hourly)?/gi,
  ];

  const matches = [];

  salaryPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      // Determine if the pattern is for a range or a single value
      const isRange = match[2] !== undefined;

      // Extract the period if present (only for patterns that capture it)
      const period = match[3] ? match[3].trim() : null;

      // Function to convert salary string to a numeric value
      const parseSalary = (salaryStr) => {
        if (!salaryStr) return null;
        let multiplier = 1;
        salaryStr = salaryStr.toUpperCase();

        if (salaryStr.endsWith('K')) {
          multiplier = 1000;
          salaryStr = salaryStr.slice(0, -1);
        } else if (salaryStr.endsWith('M')) {
          multiplier = 1000000;
          salaryStr = salaryStr.slice(0, -1);
        }

        return parseFloat(salaryStr.replace(/,/g, '')) * multiplier;
      };

      matches.push({
        value: match[0],
        min: parseSalary(match[1]),
        max: isRange ? parseSalary(match[2]) : null,
        period: period,
      });
    }
  });

  return matches;
}


function createCardLink(
  name,
  timestamp,
  title,
  experienceLevel,
  location,
  clickable = false,
  link = null,
  image = null,
  salary = null,
  tags = null,
) {
  const card = document.createElement("div");

  let tagsHtml = "";
  if (tags) {
    tagsHtml = tags
      .map(
        (tag) => `
      <div class="${tag.class} inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground flex flex-row gap-2">
      ${tag.icon ? tag.icon : ""}
        ${tag.text}
      </div>
    `,
      )
      .join("");
  }

  const cardContent = `
  <div class="flex flex-col gap-2 p-2 hover:bg-muted rounded-md" ${clickable ? `onclick="window.location.href='${link}'"` : ""}>
    <div class="flex w-full flex-col gap-0">
      <div class="flex flex-row gap-2">
        <div class="flex items-center gap-0">

        ${
          image
            ? `
                <span class="relative flex shrink-0 overflow-hidden rounded-full mr-2 h-5 w-5">
        <img class="aspect-square h-full w-full" src="${image || '/img/glyph.png'}" onerror="this.onerror=null; this.src='/img/glyph.png';" />
        </span>
        `
            : "<span class='relative flex shrink-0 overflow-hidden rounded-full mr-2 h-5 w-5'><img class='aspect-square h-full w-full' src='/img/glyph.png' /></span>"
        }
          <div class="text-sm">${name}</div>
        </div>
        <div class="ml-auto text-xs text-foreground">${timestamp}</div>
      </div>
      <div class="text-md font-semibold text-balance max-w-lg leading-relaxed">
      <a href="${link}" class="hover:text-accent">${title}</a></div>
      <div class="text-sm text-muted-foreground">${experienceLevel ? `${experienceLevel} • ` : ""}${location.replace(';','')} ${
    salary ? `• ${salary}` : ""
  }</div>
    </div>
  </div>
      `;

  card.innerHTML = cardContent;
  return card;
}


function createJobElement(job) {
  let tags = [];

      const postedDate = new Date(job.postedDate.replace(" ", "T"));
      const now = new Date();
      const diffTime = Math.abs(now - postedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const salaries = extractSalaryFromDescription(job.description + ' ' + job.MinimumQualifications + ' ' + job.PreferredQualifications);

      // new tag
      if (diffDays <= 2 && !viewedJobs.includes(job.id)) {
        tags.push({ text: "New", class: "new", icon:'<span class="flex h-2 w-2 rounded-full bg-blue-600"></span>' });
      }

      // viewed tag
      if (viewedJobs.includes(job.id)) {
        tags.push({
          text: 'Viewed',
          class: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground',
          icon: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 fill-green-300 text-green-300"><path d="M0.877075 7.49991C0.877075 3.84222 3.84222 0.877075 7.49991 0.877075C11.1576 0.877075 14.1227 3.84222 14.1227 7.49991C14.1227 11.1576 11.1576 14.1227 7.49991 14.1227C3.84222 14.1227 0.877075 11.1576 0.877075 7.49991ZM7.49991 1.82708C4.36689 1.82708 1.82708 4.36689 1.82708 7.49991C1.82708 10.6329 4.36689 13.1727 7.49991 13.1727C10.6329 13.1727 13.1727 10.6329 13.1727 7.49991C13.1727 4.36689 10.6329 1.82708 7.49991 1.82708Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>'
        });
      }

      let salaryText;
      // salary tag
      if (job.salary) {
        salaryText = `$${job.salary}`;
        if (job.salary_max) {
          salaryText += ` - $${job.salary_max}`;
        }
      } else {
        if (salaries.length !== 0) {
          salaryText = salaries[0].value;
          if (!salaryText.startsWith('$')) {
            salaryText = '$' + salaryText;
          }
          if ((salaries[0].min && salaries[0].min < 1000) || (salaries[0].max && salaries[0].max < 1000)) {
            salaryText += ' /hr';
          }
        }
      }


      // views tag
      if (job.views) {
        tags.push({
          text: `${job.views} views`,
          class: "views",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
        });
      }

      // applicants tag
      tags.push({
        text: `${job.applicants} applicants`,
        class: "applicants",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      });

  const jobElement = createCardLink(
    job.company_name,
    formatRelativeDate(job.postedDate),
    job.title,
    job.experienceLevel || job.cleaned_experience_level,
    formatLocation(job.location),
    true,
    `/jobs/${job.id}`,
    job.company_logo,
    salaryText,
    tags,
  );
  return jobElement;
}

function createCard(
  name,
  timestamp,
  title,
  experienceLevel,
  location,
  clickable = false,
  link = null,
  image = null,
  tags = null,
) {
  const card = document.createElement("div");

  let tagsHtml = "";
  if (tags) {
    tagsHtml = tags
      .map(
        (tag) => `
      <div class="${tag.class} inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground flex flex-row gap-2">
      ${tag.icon ? tag.icon : ""}
        ${tag.text}
      </div>
    `,
      )
      .join("");
  }

  const cardContent = `
<div class="flex flex-row px-1 items-start gap-2 rounded-lg text-left mb-4 text-sm transition-all hover:bg-accent" ${clickable ? `onclick="window.location.href='${link}'"` : ""}>
  <span class="relative flex shrink-0 overflow-hidden rounded-md mr-2 h-10 w-10">
    <img class="aspect-square h-full w-full" src="${image || '/img/glyph.png'}" onerror="this.src='/img/glyph.png';" />
  </span>
  <div class="flex flex-col w-full gap-1">
    <div class="flex items-center">
      <div class="flex flex-col gap-0">
        <div class="text-md font-semibold">${name}</div>
            <div class="text-base font-medium text-balance max-w-lg leading-relaxed">
            <a href="${link}" class="hover:text-accent">${title}</a>
    </div>
    ${experienceLevel ? `<div class="text-xs text-foreground flex flex-row gap-06 v-center">${experienceLevel}</div>` : ""}
      </div>
<div class="ml-auto text-xs text-foreground gap-06 v-center whitespace-nowrap">${timestamp}</div>
    </div>

    <div class="text-sm text-muted-foreground">
      ${location}
    </div>
    <div class="flex items-center gap-2 wrap">
      ${tagsHtml}
    </div>
  </div>
</div>
  `;

  card.innerHTML = cardContent;
  return card;
}

function renderJobPostings(jobPostings) {
  // remove the loading spinner
  const loadingSpinner = document.querySelector("#loading-indicator");
  if (loadingSpinner) {
    loadingSpinner.style.display = "none";
  }
  const jobListContainer = document.querySelector(".job-list");

  jobPostings.forEach((job) => {
    const jobElement = createJobElement(job);
    jobListContainer.appendChild(jobElement);
  });
}

function fetchCompanyComments(companyName) {
  return fetch(`/api/company/${encodeURIComponent(companyName)}/comments`)
    .then((response) => response.json())
    .catch((error) => console.error("Error fetching company comments:", error));
}

function formatDate(date) {
  let postDate = new Date(date);
  let today = new Date();
  let diff = today - postDate;
  let formattedDate = "";

  // Convert time difference to different units
  let minutes = Math.floor(diff / 60000); // 60,000 milliseconds in a minute
  let hours = Math.floor(diff / 3600000); // 3,600,000 milliseconds in an hour
  let days = Math.floor(diff / 86400000); // 86,400,000 milliseconds in a day

  // Decide the format based on the time difference
  if (diff < 86400000) {
    // Less than 24 hours
    if (hours < 1) {
      formattedDate = minutes + "m";
    } else {
      formattedDate = hours + "h";
    }
  } else {
    // Format date with month spelled out, e.g., "July 19, 2024"
    let options = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    formattedDate = postDate.toLocaleDateString("en-US", options);
  }

  return formattedDate;
}

document.addEventListener("DOMContentLoaded", function () {
  const description = document.getElementById("companyDescription");
  const toggleButton = document.getElementById("toggleButton");

  if (!description || !toggleButton) {
    return;
  }

  function checkOverflow() {
    const isOverflowing = description.scrollHeight > description.clientHeight;
    toggleButton.style.display = isOverflowing ? "block" : "none";
  }

  toggleButton.addEventListener("click", function () {
    description.classList.toggle("expanded");
    toggleButton.textContent = description.classList.contains("expanded")
      ? "Show less"
      : "Show more";
  });

  // Check overflow on load and resize
  window.addEventListener("resize", checkOverflow);
  checkOverflow();
});

function renderComments(comments) {
  const commentsContainer = document.querySelector(".comments-container");
  const commentsHeader = document.querySelector(
    ".company-comments-header-title",
  );
  commentsContainer.innerHTML = "";
  commentsHeader.textContent = `${comments.length} Comment${comments.length !== 1 ? "s" : ""}`;

  comments.forEach((comment) => {
    const commentElement = document.createElement("div");
    commentElement.classList.add("comment");
    commentElement.innerHTML = `
    <div class="comment-header">
      <div class="comment-author">
      <img src="${comment.user_avatar}" alt="User Avatar" class="avatar thumbnail thumbnail-tiny thumbnail-regular">
        <a class="link" href="/user/${comment.user_name}">${comment.user_name}</a>
        <p class="comment-date">${formatDate(comment.created_at)}</p>
      <button class="delete-comment cancel-button-normal no-bg no-border" data-id="${comment.id}" onclick="deleteComment(event)">Delete</button>
      </div>
      <div class="comment-content">
        <p>${comment.content}</p>
      </div>
    `;
    commentsContainer.appendChild(commentElement);
  });

  if (comments.length === 0) {
    commentsContainer.textContent = "No Comments Yet";
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    const companyNameMeta = document.querySelector('meta[name="company-name"]');
    if (companyNameMeta) {
      const companyName = companyNameMeta.content;
      fetchCompanyComments(companyName).then((comments) => {
        renderComments(comments);
      });
    }
  });
}

/*
  router.delete('/company/:name/comments/:commentId', checkAuthenticated, async (req, res) => {
    try {
      const commentId = req.params.commentId;
      await jobQueries.deleteCompanyComment(commentId);
      res.status(200).send('Comment deleted');
    } catch (err) {
      console.error('Error deleting company comment:', err);
      res.status(500).send('Error deleting company comment');
    }
  });
  */

function deleteComment(event) {
  const commentId = event.target.getAttribute("data-id");
  const companyInfo = document.querySelector(".company-info-container");
  const companyName = companyInfo.getAttribute("data-company");
  if (!commentId) {
    return;
  }

  fetch(
    `/jobs/company/${encodeURIComponent(companyName)}/comments/${commentId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  )
    .then((response) => {
      if (response.ok) {
        event.target.parentElement.parentElement.remove();
      }
    })
    .catch((error) => console.error("Error deleting comment:", error));
}

document.addEventListener("DOMContentLoaded", function () {
  const toggleButton = document.getElementById("toggleInsights");
  const insightsContainer = document.getElementById("insightsContainer");

  if (toggleButton && insightsContainer) {
    toggleButton.addEventListener("click", function () {
      if (insightsContainer.classList.contains("hidden")) {
        insightsContainer.classList.remove("hidden");
        insightsContainer.classList.add("block");
        toggleButton.textContent = "Hide Insights";
      } else {
        insightsContainer.classList.remove("block");
        insightsContainer.classList.add("hidden");
        toggleButton.textContent = "Show Insights";
      }
    });
  }
});
