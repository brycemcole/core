function formatDateJob(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  const diffInDays = Math.floor(diffInSeconds / 86400);
  const diffInWeeks = Math.floor(diffInDays / 7);

  if (diffInSeconds < 60) {
    return "Just now";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  } else if (diffInWeeks <= 4) {
    return `${diffInWeeks}w ago`;
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
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = hash & 0x00ffffff; // Ensure hash is within the range of 0x00ffffff

  // Convert hash to a hexadecimal string and pad with leading zeros
  const colorHex = ('00000' + hash.toString(16)).slice(-6);
  const tintColor = `#${colorHex}65`;

  // Blend with a desaturated base color (e.g., gray)
  const baseColor = '#808080'; // Light gray
  const blendedColor = blendColors(tintColor, baseColor, 0.5);
  return blendedColor;
}

function getTintFromNameSecondary(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = hash & 0x00ffffff; // Ensure hash is within the range of 0x00ffffff

  // Convert hash to a hexadecimal string and pad with leading zeros
  const colorHex = ('00000' + hash.toString(16)).slice(-6);
  const tintColor = `#${colorHex}`;

  // Blend with a desaturated base color (e.g., gray)
  const baseColor = '#404040'; // Dark gray
  const blendedColor = blendColors(tintColor, baseColor, 0.5);
  return blendedColor;
}

function blendColors(color1, color2, ratio) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 * ratio + r2 * (1 - ratio));
  const g = Math.round(g1 * ratio + g2 * (1 - ratio));
  const b = Math.round(b1 * ratio + b2 * (1 - ratio));

  const blendedColor = `#${r.toString(16).padStart(2, '0')}${g
    .toString(16)
    .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  return blendedColor;
}

function formatSalary(salary) {
  if (salary >= 1000000) {
    return '' + (salary / 1000000).toFixed(1) + 'M';
  } else if (salary >= 1000) {
    return '' + (salary / 1000).toFixed(0) + 'k';
  } else {
    return '' + salary;
  }
}


async function getSimilarJobs(jobId) {
  try {
    const response = await fetch(`/api/jobs/${jobId}/similar`);
    const jobs = await response.json();

    const similarJobsContainer = document.querySelector('.similar-jobs');

    if (jobs.length === 0) {
      similarJobsContainer.innerHTML = '';
      return;
    }

    similarJobsContainer.innerHTML = '<h4 class="secondary-text">Related Jobs</h4>';
    const similarJobsList = document.createElement('div');
    similarJobsList.className = 'flex flex-col gap-2 pl-2';

    jobs.forEach((job) => {
      let tags = [];
      const postedDate = new Date(job.postedDate.replace(" ", "T"));
      const now = new Date();
      const diffTime = Math.abs(now - postedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
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

      // salary tag
      if (job.salary) {
        tags.push({
          text: `$${job.salary}`,
          class: "salary",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coins"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
        });
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
        job.salary,
        tags,
      );
      similarJobsList.appendChild(jobElement);
    });

    similarJobsContainer.appendChild(similarJobsList);
  } catch (error) {
    console.error('Error fetching similar jobs:', error);
  }
}

function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInSeconds < 172800) {
    return '1d ago';
  } else {
    const month = date.toLocaleString('default', { month: 'short' });
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

function formatLocation(location) {
  if (location.includes('N/A') || location.includes('remote') || location.includes('Remote')) {
    return 'Remote';
  }

  const parts = location.split(',').map(part => part.trim());

  // Helper function to check if a string is a US state
  const isUSState = (str) => Object.keys(stateMappings).includes(str) || Object.values(stateMappings).includes(str);

  // Helper function to get state abbreviation
  const getStateAbbr = (state) => {
    const fullName = Object.keys(stateMappings).find(key => key.toLowerCase() === state.toLowerCase());
    return fullName ? stateMappings[fullName] : state;
  };

  // Helper function to get country abbreviation
  const getCountryAbbr = (country) => {
    const fullName = Object.keys(countryMappings).find(key => key.toLowerCase() === country.toLowerCase());
    return fullName ? countryMappings[fullName] : country;
  };

  // Helper function to format a single location
  const formatSingleLocation = (city, state, country) => {
    const isRemote = (city.toLowerCase() === 'remote' || city.toLowerCase() === 'n/a');

    if (country && country !== 'N/A') {
      const countryAbbr = getCountryAbbr(country);
      if (countryAbbr.toLowerCase() === 'usa' || country.toLowerCase() === 'united states' || country.toLowerCase() === 'us') {
        if (isRemote) {
          return 'Remote, USA';
        } else {
          return `${city !== 'N/A' ? city + ', ' : ''}${state !== 'N/A' ? getStateAbbr(state) : 'USA'}`;
        }
      } else {
        if (isRemote) {
          return `Remote, ${countryAbbr}`;
        } else {
          return `${city !== 'N/A' ? city : ''}${state !== 'N/A' && state !== city ? '/' + getStateAbbr(state) : ''}, ${countryAbbr}`;
        }
      }
    } else if (state && state !== 'N/A') {
      return `${isRemote ? 'Remote, ' : ''}${isUSState(state) ? getStateAbbr(state) : state}`;
    } else if (city && city !== 'N/A') {
      return city;
    } else {
      return 'Remote';
    }
  };

  // Process multiple locations
  const locations = [];
  for (let i = 0; i < parts.length; i += 3) {
    const city = parts[i];
    const state = parts[i + 1] || '';
    const country = parts[i + 2] || '';

    locations.push(formatSingleLocation(city, state, country));
  }

  return locations.join('; ');
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
  const postedDate = new Date(job.postedDate.replace(" ", "T"));
      const now = new Date();
      const diffTime = Math.abs(now - postedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      let tags = [];
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

      // salary tag
      if (job.salary) {
        tags.push({
          text: `$${job.salary}`,
          class: "salary",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coins"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
        });
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
    job.salary,
    tags,
  );
  return jobElement;
}
async function getSimilarJobsByCompany(jobId) {
  try {
    const response = await fetch(`/api/jobs/${jobId}/similar-company`);
    const jobs = await response.json();

    const similarJobsContainer = document.querySelector('.similar-company-jobs');

    if (jobs.similarJobs.length === 0) {
      similarJobsContainer.innerHTML = '<div class="empty-text">No similar jobs found.</div>';
      return;
    }

    similarJobsContainer.innerHTML = `<h4 class="secondary-text">More at ${jobs.companyName}</h4>`;
    const similarJobsList = document.createElement('div');
    similarJobsList.className = 'flex flex-col gap-2 px-2';

    jobs.similarJobs.forEach((job) => {
      const jobElement = createJobElement(job);
      similarJobsList.appendChild(jobElement);
    });

    similarJobsContainer.appendChild(similarJobsList);
  } catch (error) {
    console.error('Error fetching similar jobs:', error);
  }
}

function formatDateColor(dateString) {
  const now = new Date();
  const postedDate = new Date(dateString); 
  // if within 2 weeks, green, if within 2 months, yellow, if older, red
  const diffTime = Math.abs(now - postedDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 14) {
    return 'green';
  } else if (diffDays <= 60) {
    return 'yellow';
  } else {
    return 'red';
  }
}

function applyForJob(event, jobId, jobLink) {
  // Prevent the default action (which might be causing the redirect)
  event.preventDefault();
  window.open(jobLink, '_blank');
  // Make the POST request
  fetch(`/api/jobs/${jobId}/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // You can add a body here if needed
    // body: JSON.stringify({}),
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
    // showBannerNotification(data.message);
    })
    .catch(error => {
      console.error('Error:', error);
      showBannerNotification('An error occurred. Please try again.');
    }
    );
}

async function lazyLoadJobDetails(user, jobId) {
  fetch(`/api/jobs/${jobId}`)
    .then((response) => response.json()) 
    .then((job) => {
      if (user && !job.isProcessed && user.isPremium === true) {
        processJobPosting(jobId);
      }
      const jobDetailsContainer = document.querySelector(
        '.job-details-container'
      );

      let benefitsArray, skillsArray;
      try {
        // Extract skills from job description using keyword search
        const keywords = ['JavaScript', 'Python', 'Java', 'C++', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Kubernetes', 'CRM', 'Salesforce', 'Node.js', 'cybersecurity', 'Power BI', 'Excel', 'Data Visualization', 'Statistics', 'Finance'];
        skillsArray = keywords.filter(keyword => 
          job.description.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // If no skills found in description, fallback to existing skills
        if (skillsArray.length === 0 && job.skills) {
          skillsArray = job.skills.split(', ');
        }
      } catch (error) {
        console.error('Error extracting skills:', error);
        skillsArray = [];
      }

      try {
        benefitsArray = job.benefits ? job.benefits.split(',') : [];
      } catch (error) {
        console.error('Error splitting benefits:', error);
        benefitsArray = [];
      }

      const formattedBenefits = benefitsArray
        .map((benefit) => `<li>${benefit.replace(/'/g, '')}</li>`)
        .join('');

      const maxSkills = 10;
      const displayedSkills = skillsArray.slice(0, maxSkills);

      const skillsHTML = displayedSkills
        .map(
          (skill) =>
            `<a class="mini-text bold" href="/jobs?skill=${encodeURIComponent(skill.trim())}">${skill}</a>`
        )
        .join(', ');
      

      const remainingSkills = skillsArray.length - maxSkills;

      const isOlderThan30Days = (job) => {
        const postedDate = new Date(job.postedDate);
        const currentDate = new Date();
        const daysDifference =
          (currentDate - postedDate) / (1000 * 60 * 60 * 24);
        return daysDifference > 30;
      };

      jobDetailsContainer.innerHTML = `
        <div class="job-listing">
        <div class="job-listing-menu">
<nav class="breadcrumbs">
<ol class="flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5">
<a href="/jobs" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary underline-offset-4 hover:underline">Jobs</a>
<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
<img src="${job.company_logo}" style="width: auto;" alt="${job.company_name} logo" onerror="this.onerror=null;this.src='/img/glyph.png';" class="thumbnail-micro thumbnail-regular" />
<a class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary underline-offset-4 hover:underline" href="/jobs/company/${encodeURIComponent(job.company_name)}">${job.company_name}</a>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
            </svg>
</ol>
</nav>
      <div class="company-info w-100">
        <div class="company-details w-full">
      <div class="flex flex-col gap-2">
          <h3 class="font-semibold tracking-tight text-2xl">
        ${job.title}
      </h3>
      <p class="text-sm text-muted-foreground"> 
                    ${job.experienceLevel ? `
          <span class="sub-text bold text-muted-foreground">
        ${job.experienceLevel}
        </span>  
                <span class="sub-text">•</span>

        ` : ''}
          ${
  job.location
    .split(',')
    .map(loc => loc.trim().toLowerCase())
    .filter(loc => !loc.toLowerCase().includes('n/a'))
    .map(loc => {
      if (loc.toLowerCase().includes('remote')) {
        return '<a class="mini-text" href="/jobs?locations=Remote">Remote</a>';
      } else {
        // Capitalize the first letter of each word in the country for display
        const country = loc
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return `<a class="sub-text text-muted-foreground" href="/jobs?locations=${encodeURIComponent(loc)}">${country}</a>`;
      }
    })
    .join(', ')
}


<span class="sub-text">•</span>

<span class="sub-text">
                  ${job.applicants ? job.applicants : 0} applicants
</span>
      <span class="sub-text">•</span>
      <time class="sub-text primary-text">${formatDateJob(job.postedDate)}</time>

      </p>
      ${job.skills_string ? `
      <p class="text-sm text-balance max-w-lg leading-relaxed">
         ${job.skills_string}
      </p>
      ` : ''}

      ${job.accepted_college_majors ? `
      <span class="flex flex-row gap-2 v-center text-sm text-balance max-w-lg leading-relaxed">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-school"><path d="M14 22v-4a2 2 0 1 0-4 0v4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M18 5v17"/><path d="m4 6 8-4 8 4"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/></svg> ${job.accepted_college_majors}
      </span>
      ` : ''}
    <div class="flex flex-row gap-4 v-center">
            <div class="flex flex-row gap-06 v-center">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              <p class="text-sm text-balance max-w-lg leading-relaxed">${job.relocation ? 'Relocation offered' : 'No relocation'}</p>
            </div>
            <div class="flex flex-row gap-06 v-center">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-laptop"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>
              <p class="text-sm text-balance max-w-lg leading-relaxed">${job.isRemote ? 'Remote work available' : 'On-site only'}</p>
            </div>
            ${user && user.isPremium ? `
                        <div class="flex flex-row gap-06 v-center">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>              <p class="text-sm text-balance max-w-lg leading-relaxed">${job.views} views</p>
            </div>
            ` : ''}
          </div>
          <div class="job-recruiter-container">
        <div class="job-recruiter-info">
          <div class="recruiter-info flex flex-row gap-06">
            <a href="/user/${job.recruiter_username}" class="recruiter-image">
                <img class="thumbnail thumbnail-micro thumbnail-regular" src="${job.recruiter_image}" alt="${job.company_name} logo" />
            </a>
            <div class="recruiter-details flex flex-row gap-2">
              <p class="text-sm text-balance max-w-lg leading-relaxed">
                Posted by
                    @<a href="/user/${job.recruiter_username}" class="mini-text">${job.recruiter_username}</a>
              </p>
            </div>
          </div>
        </div>
      </div>
          ${!job.isProcessed && user && user.isPremium ? `
                <div class="adaptive-border rounded">
      <div class="sub-text p-4 flex items-center">
        <span class="material-symbols-outlined animate-spin mr-2" style="color: #6366f1;">auto_awesome</span>
        <span class='please-wait-button'>Please wait a moment while we improve this job posting!</span>
      </div>
      </div>
      ` : ''}
      <!--
          ${!job.isProcessed && user && !user.isPremium ? `
                <div class="adaptive-border rounded">
      <div class="sub-text p-4 flex items-center">
        <span class="material-symbols-outlined mr-2" style="color: #6366f1;">star</span>
        <span>Sign up for premium to generate better overviews of these job postings</span>
      </div>
      </div>
      ` : ''}
      -->

      ${ job.salary || job.salary_max ? `
        <div class="job-info-flairs text-sm text-balance max-w-lg leading-relaxed">
      ${job.salary !== 0 ? `
        <span class="salary flex flex-row gap-2">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coins"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>
      USD $${formatSalary(job.salary)}
      ${job.salary_max !== 0 ? `- $${formatSalary(job.salary_max)}` : ''}
      ${!job.location.toLowerCase().includes('us') && 
        !job.location.toLowerCase().includes('united states') &&
        !(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|remote|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/i.test(job.location))
    ? '<span class="currency-warning"> (currency may not be in USD)</span>' 
    : ''}
        </span>
      ` : ''}
      
        </div>
        ` : ''}
      

      <!-- end of the top menu -->
    </div>
      
        </div>
        
      </div>


<div class="flex flex-col gap-06">
      <div class="interact-buttons flex flex-row gap-4 v-center">
        ${
  (job)
    ? `<div class="apply-button-container flex gap-4">
                <button class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-4 py-2" onclick="applyForJob(event, '${job.id}', '${job.link}')">
<svg xmlns="http://www.w3.org/2000/svg" class="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-briefcase"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
                  
                  <span class="sub-text">Apply</span>
                </button>
                <button class="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-8 gap-1" id="favorite-button" onclick="favorite('job', ${job.id});">
                  <span class="sub-text">Save</span>
                </button>
                  </div>`
    : ''
} 
        <div class="second-buttons-container">
                  <div class="dropdown" tabindex="0">
            <button aria-label="Dropdown" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 w-8" style="padding-top: .4rem; padding-bottom: .4rem;" aria-haspopup="true" aria-expanded="false">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </button>

            <div class="dropdown-content">
            <a class="grow-button margin-h-auto">

            <button class="no-margin no-padding no-bg no-border" onclick="share('${job.title}', '', 'https://getcore.dev/jobs/${job.id}', 'job', '${job.id}');">
          <span class="material-symbols-outlined">share</span>
          <span class="sub-text">Share</span>
        </button>
        </a>
                       ${
  user && user.isPremium
    ? `
      <div class="resume-button w-100">
        <a href="/api/create-resume/${job.id}" class="grow-button margin-h-auto">
          <span class="material-symbols-outlined">description</span>
          <span class="sub-text">Resume</span>
        </a>
      </div>
      <div class="cover-letter-button w-100">
        <a href="/api/create-cover-letter/${job.id}" class="grow-button margin-h-auto">
          <span class="material-symbols-outlined">description</span>
          <span class="sub-text">Cover Letter</span>
        </a>
      </div>
      <div class="delete-button-container">
              <a class="grow-button margin-h-auto cancel-button-text" href="/jobs/delete/${job.id}">
          <span class="material-symbols-outlined">delete</span>
          <span class="sub-text">Delete</span>
        </a>
      </div> `
    : ''}
</div>

</div>
            </div>
            
          </div>
                ${
  isOlderThan30Days(job)
    ? '<div class="caution-messages">This job was posted more than 30 days ago.</div>'
    : ''
}
              ${!user ? `
      <p class="grid gap-6 rounded-lg border p-4 flex flex-col gap-06 adaptive-border">
        <span class="text-sm text-balance max-w-lg leading-relaxed">
          <i class="fas fa-info-circle"></i>
            Sign up or login to view job matches personalized to your resume! Build your resume, cover letter, and profile to get started.
            </span>
            <a href="/login">
            <button class="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs w-full">
              <span class="sub-text">Sign up</span>
            </button>
            </a>
      </p>
    ` : ''}
    </div>
</div>
  </div>
</div>
            <div class="job-details primary-text company-profile-section">
            ${job.company_description && job.company_description.length > 10 ? `
            <div class="company-description sub-text">
              <h4 class="font-semibold leading-none tracking-tight">Company Description</h4>
              <p class="text-sm text-balance max-w-lg leading-relaxed">${job.company_description}</p>
            </div>
            ` : ''}

            ${ !job.isProcessed ? `
            <div class="job-posting-description sub-text">
              <h4 class="font-semibold leading-none tracking-tight">Job Description</h4>
              <span class="text-sm text-balance max-w-lg leading-relaxed">${job.description}</span>
            </div>
            ` : ''}

              ${job.isProcessed ? `
            <div class="job-posting-description ${job.recruiter_username === 'autojob' ? 'ai-generated-content' : ''}">

      <h4 class="font-semibold leading-none tracking-tight" style="margin-top:0;"><span class="material-symbols-outlined" style="color: #6366f1;">auto_awesome</span> AI-Generated Overview</h4>
    <p class="text-sm text-balance max-w-lg leading-relaxed">
    ${job.description.replace('??', '')}
    </p>
    </div>

    ` : ''}
            ${
  job.Requirements
    ? `
            <div class="font-semibold leading-none tracking-tight">
              <h4 class="font-semibold leading-none tracking-tight">Requirements</h4>
              <p class="text-sm text-balance max-w-lg leading-relaxed">${job.Requirements}</p>
            </div>
            `
    : ''
}

            ${
  job.Responsibilities
    ? `
            <div class="job-responsibilities">
              <h4 class="font-semibold leading-none tracking-tight">Responsibilities</h4>
              <p class="text-sm text-balance max-w-lg leading-relaxed">${job.Responsibilities}</p>
            </div>
            `
    : ''
}
            
            ${
  job.MinimumQualifications
    ? `
<div class="minimum-qualifications">
  <h4 class="font-semibold leading-none tracking-tight">Minimum Qualifications</h4>
  <p class="text-sm text-balance max-w-lg leading-relaxed">${job.MinimumQualifications}</p>
</div>
`
    : ''
}

${
  job.PreferredQualifications
    ? `
<div class="preferred-qualifications">
  <h4 class="font-semibold leading-none tracking-tight">Preferred Qualifications</h4>
  <p class="text-sm text-balance max-w-lg leading-relaxed">${job.PreferredQualifications}</p>
</div>
`
    : ''
}

${
  formattedBenefits
    ? `
<div class="job-benefits">
  <h4 class="font-semibold leading-none tracking-tight">Job Benefits</h4>
  <ul class="text-sm text-balance max-w-lg leading-relaxed">
    ${formattedBenefits}
  </ul>
</div>
`
    : ''
}

${
  job.NiceToHave
    ? `
<div class="job-nice-to-have">
  <h4 class="font-semibold leading-none tracking-tight">Nice to Have</h4>
  <p class="text-sm text-balance max-w-lg leading-relaxed">${job.NiceToHave}</p>
</div>
`
    : ''
}

${
  job.schedule
    ? `
<div class="job-schedule">
  <h4 class="font-semibold leading-none tracking-tight">Schedule</h4>
  <p class="text-sm text-balance max-w-lg leading-relaxed">${job.schedule}</p>
</div>
`
    : ''
}

${
  job.hoursPerWeek
    ? `
<div class="job-hours-per-week">
  <h4 class="font-semibold leading-none tracking-tight">Hours per Week</h4>
  <p class="text-sm text-balance max-w-lg leading-relaxed">${job.hoursPerWeek}</p>
</div>
`
    : ''
}

${
  job.equalOpportunityEmployerInfo
    ? `
<div class="job-equal-opportunity-employer-info">
  <h4 class="font-semibold leading-none tracking-tight">Equal Opportunity Employer Info</h4>
  <p class="text-sm text-balance max-w-lg leading-relaxed">${job.equalOpportunityEmployerInfo}</p>
</div>
`
    : ''
}

${
  job.raw_description_no_format
    ? `
<div class="raw-description-no-format">
  <h4 class="font-semibold leading-none tracking-tight">Job Description (from the company)</h4>
  <p class="text-sm text-balance max-w-lg leading-relaxed">${job.raw_description_no_format}</p>
</div>
`
    : ''
}

<div class="flex">
<div class="autojob-warning px-4 py-2">
                    <span class="warning-icon">⚠️</span>
                    <span class="warning-text">This post is scraped from the internet and may contain errors.</span>
                </div>
                </div>


</div>

              
          </div>
        </div>
        <div class="similar-jobs company-profile-section">
        <div id="loading-indicator">
          <div class="spinner-container">
            <div class="spinner"></div>
          </div>
        </div>
</div>
<div class="similar-company-jobs company-profile-section">
        <div id="loading-indicator">
          <div class="spinner-container">
            <div class="spinner">
            </div>
          </div>
        </div>
</div>
      `;
    })
    .catch((error) => {
      console.error('Error fetching job details:', error);
    })

}

function processJobPosting(jobId) {
  fetch(`/jobs/process/${jobId}`)
    .then((response) => response.json())
    .then((data) => {
      const processJobButton = document.getElementById('processJobButton');
      const generateInsightsText = document.getElementById('generate-insights-text');
      
      generateInsightsText.innerHTML = 'Done processing! Click to reload';
      processJobButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw opacity-60" aria-hidden="true">
          <path d="M23 4v6h-6"></path>
          <path d="M1 20v-6h6"></path>
          <path d="M3.51 9a9 9 0 1 1-.44 5h-2"></path>
        </svg>`;
      processJobButton.onclick = () => {
        window.location.reload();
      };
    })
    .catch((error) => {
      console.error('Error processing job posting:', error);
    });
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

function bindSelectorButtons() {
  const companyProfileButtons = document.querySelectorAll('.company-navbar-button');
  const companyProfileSections = document.querySelectorAll('.company-profile-section');

  companyProfileButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-id');

      companyProfileSections.forEach(section => {
        if (section.className.includes(targetId)) {
          section.style.display = 'block';
        } else {
          section.style.display = 'none';
        }
      });

      // Update active button state (optional)
      companyProfileButtons.forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
    });
  });
}
function checkFavorite(jobId) {
  fetch(`/favorites/isFavorite/job/${jobId}`)
    .then((response) => response.json())
    .then((data) => {
      const favoriteButton = document.getElementById('favorite-button');
      if (data.isFavorite) {
        
        favoriteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark-x"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/><path d="m14.5 7.5-5 5"/><path d="m9.5 7.5 5 5"/></svg>';
      } else {

        favoriteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>';
      }
    })
    .catch((error) => {
      console.error('Error checking favorite:', error);
    });
}

function favorite(favoriteType, TypeId) {
  const endpoints = {
    job: `/favorites/jobs/${TypeId}`,
    post: `/favorites/posts/${TypeId}`,
  };

  const endpoint = endpoints[favoriteType];
  if (!endpoint) {
    console.error('Invalid favorite type');
    return;
  }

  let favoriteButton;
  if (favoriteType === 'job') {
    favoriteButton = document.getElementById('favorite-button');
    toggleFavoriteButton(favoriteButton);
  }

  fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        showBannerNotification(data.message);
      } else if (data.redirect) {
        window.location.href = data.redirect;
      } else {
        showBannerNotification(data.message);
        if (favoriteType === 'job') {
          // Revert button state if operation wasn't successful
          toggleFavoriteButton(favoriteButton);
        }
      }
    })
    .catch((error) => {
      console.error('Error adding to favorites:', error);
      showBannerNotification('An error occurred. Please try again.');
      if (favoriteType === 'job') {
        // Revert button state on error
        toggleFavoriteButton(favoriteButton);
      }
    });
}

function report(reportType, TypeId) {
  const endpoints = {
    job: `/report/job/${TypeId}`,
    post: `/report/post/${TypeId}`,
  };

  const endpoint = endpoints[reportType];
  if (!endpoint) {
    console.error('Invalid report type');
    return;
  }

  fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      showBannerNotification(data.message);
    })
    .catch((error) => {
      console.error('Error reporting:', error);
      showBannerNotification('An error occurred. Please try again.');
    });
}
function toggleFavoriteButton(button) {
  if (button.innerHTML === '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark-x"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/><path d="m14.5 7.5-5 5"/><path d="m9.5 7.5 5 5"/></svg>') {
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>';
  } else {
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark-x"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/><path d="m14.5 7.5-5 5"/><path d="m9.5 7.5 5 5"/></svg>';
  }
}