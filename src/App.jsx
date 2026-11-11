import { useEffect, useMemo, useRef, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
} from "chart.js";

ChartJS.register(ArcElement, Legend, Tooltip);

const chartColors = [
  "#58a6ff",
  "#f78166",
  "#2ea043",
  "#d29922",
  "#a371f7",
  "#ff7b72",
];

async function fetchGitHubJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("User not found");
    }
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub API rate limit reached. Please try again later.");
    }
    throw new Error(`GitHub request failed (${response.status})`);
  }
  return response.json();
}

function getProfileSummary(repositories) {
  const languages = new Map();
  for (const repository of repositories) {
    if (repository.language) {
      languages.set(
        repository.language,
        (languages.get(repository.language) || 0) + 1,
      );
    }
  }

  const topLanguage =
    [...languages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
  const bestRepo = repositories.reduce(
    (best, repository) =>
      !best || repository.stargazers_count > best.stargazers_count
        ? repository
        : best,
    null,
  );

  return {
    topLanguage,
    bestRepo: bestRepo || { name: "N/A", stargazers_count: 0 },
  };
}

function getActivityStatus(events) {
  if (events.length === 0) {
    return { label: "⚪ No Public Activity", className: "no-activity" };
  }

  const daysSinceLastEvent =
    (Date.now() - new Date(events[0].created_at).getTime()) /
    (1000 * 60 * 60 * 24);
  return daysSinceLastEvent <= 7
    ? { label: "🟢 Active Developer", className: "active" }
    : { label: "🔴 Not Recently Active", className: "inactive" };
}

function Stat({ label, value }) {
  return (
    <div className="stat-box">
      {label}
      <br />
      <strong>{value}</strong>
    </div>
  );
}

function RepositoryCard({ repository }) {
  return (
    <div className="repo">
      <strong>{repository.name}</strong>
      <p>{repository.description || ""}</p>
      <span>
        ⭐ {repository.stargazers_count} | 🍴 {repository.forks_count}
      </span>
      <br />
      <a href={repository.html_url} target="_blank" rel="noreferrer">
        View Repository
      </a>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repositoryQuery, setRepositoryQuery] = useState("");
  const [sortBy, setSortBy] = useState("stars");
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem("theme") || "dark",
  );
  const [copyMessage, setCopyMessage] = useState("");
  const profileSection = useRef(null);

  useEffect(() => {
    document.body.classList.toggle("light", theme === "light");
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const summary = useMemo(
    () => getProfileSummary(repositories),
    [repositories],
  );

  const languageData = useMemo(() => {
    const counts = new Map();
    for (const repository of repositories) {
      if (repository.language) {
        counts.set(
          repository.language,
          (counts.get(repository.language) || 0) + 1,
        );
      }
    }

    return {
      labels: [...counts.keys()],
      datasets: [
        {
          data: [...counts.values()],
          backgroundColor: chartColors,
        },
      ],
    };
  }, [repositories]);

  const visibleRepositories = useMemo(() => {
    const filtered = repositories.filter((repository) =>
      repository.name.toLowerCase().includes(repositoryQuery.toLowerCase()),
    );
    if (sortBy === "forks") {
      filtered.sort((a, b) => b.forks_count - a.forks_count);
    } else if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered.sort((a, b) => b.stargazers_count - a.stargazers_count);
    }
    return filtered.slice(0, 8);
  }, [repositories, repositoryQuery, sortBy]);

  async function getProfile(event) {
    event.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError("Enter a GitHub username to search.");
      return;
    }

    setLoading(true);
    setError("");
    setProfile(null);
    setRepositories([]);
    setEvents([]);
    setRepositoryQuery("");

    try {
      const user = await fetchGitHubJson(
        `https://api.github.com/users/${encodeURIComponent(cleanUsername)}`,
      );
      const [reposResult, eventsResult] = await Promise.allSettled([
        fetchGitHubJson(`${user.repos_url}?per_page=100`),
        fetchGitHubJson(`${user.url}/events?per_page=100`),
      ]);

      if (reposResult.status === "rejected") {
        throw reposResult.reason;
      }

      setProfile(user);
      setRepositories(reposResult.value);
      if (eventsResult.status === "fulfilled") {
        setEvents(eventsResult.value);
      } else {
        setError("Profile loaded, but recent activity could not be retrieved.");
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to load this GitHub profile.");
    } finally {
      setLoading(false);
    }
  }

  async function copyProfileLink() {
    const url = profile?.html_url || window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("Copied!");
      window.setTimeout(() => setCopyMessage(""), 1500);
    } catch {
      window.prompt("Copy profile URL:", url);
    }
  }

  async function downloadPDF() {
    if (!profileSection.current) return;
    try {
      const { default: html2pdf } = await import("html2pdf.js");
      await html2pdf()
        .from(profileSection.current)
        .save(`${profile.login}-github-profile.pdf`);
    } catch {
      setError("Unable to create the PDF. Please try again.");
    }
  }

  const activityStatus = profile ? getActivityStatus(events) : null;

  return (
    <main className="app-shell">
      <button
        className="toggle"
        type="button"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      >
        Toggle Mode
      </button>

      <section className="container" id="profileSection" ref={profileSection}>
        <h1>GitHub Profile Finder</h1>

        <form className="search-box" onSubmit={getProfile}>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter GitHub username"
            aria-label="GitHub username"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {loading && <p className="loading" role="status">Loading...</p>}
        {error && <p className="error" role="alert">{error}</p>}

        {profile && (
          <div className="profile-content">
            <div className="profile">
              <img
                className="avatar"
                src={profile.avatar_url}
                alt={`${profile.login}'s avatar`}
              />
              <div className="profile-details">
                <h2>{profile.name || profile.login}</h2>
                <span className={`status-badge ${activityStatus.className}`}>
                  {activityStatus.label}
                </span>
                <p>{profile.bio || ""}</p>
                <p>📍 {profile.location || "N/A"}</p>
                <p>🏢 {profile.company || "N/A"}</p>
                <p>
                  🔗{" "}
                  {profile.blog ? (
                    <a href={profile.blog} target="_blank" rel="noreferrer">
                      {profile.blog}
                    </a>
                  ) : (
                    "N/A"
                  )}
                </p>
                <p>📅 Joined: {new Date(profile.created_at).toDateString()}</p>

                <div className="stats">
                  <Stat label="Followers" value={profile.followers} />
                  <Stat label="Following" value={profile.following} />
                  <Stat label="Repos" value={profile.public_repos} />
                  <Stat
                    label="Total Stars"
                    value={repositories.reduce(
                      (total, repository) =>
                        total + repository.stargazers_count,
                      0,
                    )}
                  />
                </div>

                <div className="feature-strip">
                  <div className="mini-feature">
                    <span>Top language</span>
                    <strong>{summary.topLanguage}</strong>
                  </div>
                  <div className="mini-feature">
                    <span>Best repo</span>
                    <strong>{summary.bestRepo.name}</strong>
                  </div>
                  <div className="mini-feature">
                    <span>Profile link</span>
                    <strong>
                      <a
                        href={profile.html_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    </strong>
                  </div>
                </div>

                <button className="copy-btn" type="button" onClick={copyProfileLink}>
                  {copyMessage || "Copy profile link"}
                </button>
                <button className="download" type="button" onClick={downloadPDF}>
                  Download PDF
                </button>
              </div>
            </div>

            {profile.location ? (
              <>
                <h3 className="section-heading">📍 Location Map</h3>
                <div className="map-container">
                  <iframe
                    title={`Map of ${profile.location}`}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(profile.location)}&output=embed`}
                    loading="lazy"
                  />
                </div>
              </>
            ) : (
              <p className="section-heading">📍 Location not available</p>
            )}

            <h3 className="section-heading">Contribution Graph</h3>
            <img
              className="contribution-graph"
              src={`https://ghchart.rshah.org/${encodeURIComponent(profile.login)}`}
              alt={`${profile.login}'s contribution graph`}
            />

            <h3 className="section-heading">Language Usage</h3>
            {languageData.labels.length ? (
              <div className="chart-container">
                <Pie data={languageData} />
              </div>
            ) : (
              <p>No language data available.</p>
            )}

            <h3 className="section-heading">Pinned Repositories</h3>
            {repositories
              .slice()
              .sort((a, b) => b.stargazers_count - a.stargazers_count)
              .slice(0, 3)
              .map((repository) => (
                <div className="repo" key={repository.id}>
                  <strong>{repository.name}</strong>
                  <br />
                  ⭐ {repository.stargazers_count}
                </div>
              ))}
            {!repositories.length && <p>No public repositories found.</p>}

            <h3 className="section-heading">Top Repositories</h3>
            <label className="visually-hidden" htmlFor="repository-sort">
              Sort repositories
            </label>
            <select
              id="repository-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="stars">Sort by Stars</option>
              <option value="forks">Sort by Forks</option>
              <option value="name">Sort by Name</option>
            </select>
            <input
              className="repo-search"
              type="search"
              value={repositoryQuery}
              onChange={(event) => setRepositoryQuery(event.target.value)}
              placeholder="Search repos..."
              aria-label="Search repositories"
            />
            {visibleRepositories.length ? (
              visibleRepositories.map((repository) => (
                <RepositoryCard key={repository.id} repository={repository} />
              ))
            ) : (
              <p>No matching repositories.</p>
            )}

            <h3 className="section-heading">Recent Activity</h3>
            {events.length ? (
              events.slice(0, 5).map((activity, index) => (
                <div className="repo" key={`${activity.id}-${index}`}>
                  {activity.type} at {activity.repo.name}
                </div>
              ))
            ) : (
              <p>No recent public activity.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
