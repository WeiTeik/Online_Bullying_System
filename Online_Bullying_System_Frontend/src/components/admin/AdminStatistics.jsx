import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getComplaints } from '../../services/api';

const CATEGORY_OPTIONS = [
  'Verbal Bullying',
  'Physical Bullying',
  'Cyber Bullying',
  'Social Exclusion',
  'Harassment',
  'Other',
];

const CATEGORY_COLORS = {
  'Verbal Bullying': '#FF6B6B',
  'Physical Bullying': '#4ECDC4',
  'Cyber Bullying': '#5567FF',
  'Social Exclusion': '#FFB347',
  Harassment: '#A06CD5',
  Other: '#95A5A6',
  Total: '#B14AED',
};

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FILTER_MODES = {
  YEAR: 'year',
  RANGE: 'range',
};

function normalizeIncidentType(value) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return 'Other';
  if (normalized.includes('verbal')) return 'Verbal Bullying';
  if (normalized.includes('physical')) return 'Physical Bullying';
  if (normalized.includes('cyber')) return 'Cyber Bullying';
  if (normalized.includes('social')) return 'Social Exclusion';
  if (normalized.includes('harass')) return 'Harassment';
  const directMatch = CATEGORY_OPTIONS.find((option) => option.toLowerCase() === normalized);
  return directMatch || 'Other';
}

function extractComplaintDate(complaint) {
  const dateString = complaint?.submitted_at || complaint?.incident_date || complaint?.updated_at;
  if (!dateString) return null;
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildYearRange(year) {
  if (!Number.isFinite(year)) return [];
  return Array.from({ length: 12 }, (_, index) => ({
    key: `${year}-${String(index + 1).padStart(2, '0')}`,
    label: `${MONTH_SHORT_NAMES[index]} ${year}`,
    monthIndex: index,
    year,
  }));
}

function parseMonthInput(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [yearStr, monthStr] = value.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

function buildRange(filters) {
  if (filters.mode === FILTER_MODES.YEAR) {
    return buildYearRange(filters.year);
  }
  const start = parseMonthInput(filters.startMonth);
  const end = parseMonthInput(filters.endMonth);
  if (!start || !end) {
    return buildYearRange(filters.year);
  }
  const startKey = start.year * 12 + start.monthIndex;
  const endKey = end.year * 12 + end.monthIndex;
  const [from, to] = startKey <= endKey ? [start, end] : [end, start];
  const range = [];
  let year = from.year;
  let monthIndex = from.monthIndex;
  while (year < to.year || (year === to.year && monthIndex <= to.monthIndex)) {
    range.push({
      key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      label: `${MONTH_SHORT_NAMES[monthIndex]} ${year}`,
      year,
      monthIndex,
    });
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }
  return range;
}

function formatFiltersLabel(filters) {
  if (filters.mode === FILTER_MODES.YEAR) return `${filters.year}`;
  const start = parseMonthInput(filters.startMonth);
  const end = parseMonthInput(filters.endMonth);
  if (!start || !end) return '';
  return `${MONTH_SHORT_NAMES[start.monthIndex]} ${start.year} – ${MONTH_SHORT_NAMES[end.monthIndex]} ${end.year}`;
}

const AdminStatistics = () => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('statistics');
  const [selectedCategories, setSelectedCategories] = useState(CATEGORY_OPTIONS);
  const [filters, setFilters] = useState({
    mode: FILTER_MODES.YEAR,
    year: currentYear,
    startMonth: `${currentYear}-01`,
    endMonth: `${currentYear}-12`,
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(filters);
  const [filterError, setFilterError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');
    getComplaints()
      .then((data) => {
        if (!isMounted) return;
        setComplaints(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to fetch complaints for statistics', err);
        setError('Unable to load statistics. Please try again later.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set();
    complaints.forEach((complaint) => {
      const date = extractComplaintDate(complaint);
      if (date) years.add(date.getFullYear());
    });
    if (!years.size) years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [complaints, currentYear]);

  useEffect(() => {
    if (!availableYears.includes(filters.year)) {
      const fallbackYear = availableYears[0];
      setFilters((prev) => ({
        ...prev,
        year: fallbackYear,
        startMonth: `${fallbackYear}-01`,
        endMonth: `${fallbackYear}-12`,
      }));
    }
  }, [availableYears, filters.year]);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const monthRange = useMemo(() => buildRange(filters), [filters]);

  const chartData = useMemo(() => {
    if (!monthRange.length) return [];
    const base = monthRange.map(({ label }) => {
      const entry = { month: label };
      CATEGORY_OPTIONS.forEach((option) => {
        entry[option] = 0;
      });
      entry.Total = 0;
      return entry;
    });
    const indexByKey = new Map(monthRange.map(({ key }, idx) => [key, idx]));

    complaints.forEach((complaint) => {
      const date = extractComplaintDate(complaint);
      if (!date) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const index = indexByKey.get(monthKey);
      if (index === undefined) return;
      const category = normalizeIncidentType(complaint.incident_type);
      base[index][category] += 1;
      base[index].Total += 1;
    });

    return base;
  }, [complaints, monthRange]);

  const hasAnyData = useMemo(() => {
    if (!chartData.length) return false;
    if (viewMode === 'statistics') {
      return chartData.some((row) => selectedCategories.some((category) => row[category] > 0));
    }
    return chartData.some((row) => row.Total > 0);
  }, [chartData, selectedCategories, viewMode]);

  const handleCategoryToggle = (category) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((item) => item !== category);
      }
      const nextSelection = [...prev, category];
      return CATEGORY_OPTIONS.filter((option) => nextSelection.includes(option));
    });
  };

  const handleOpenFilter = () => {
    setFilterError('');
    setDraftFilters(filters);
    setFilterPanelOpen((open) => !open);
  };

  const handleApplyFilters = () => {
    if (draftFilters.mode === FILTER_MODES.RANGE) {
      const start = parseMonthInput(draftFilters.startMonth);
      const end = parseMonthInput(draftFilters.endMonth);
      if (!start || !end) {
        setFilterError('Select both a start and end month.');
        return;
      }
      const startIndex = start.year * 12 + start.monthIndex;
      const endIndex = end.year * 12 + end.monthIndex;
      if (startIndex > endIndex) {
        setFilterError('Start month must be earlier than end month.');
        return;
      }
    }
    setFilterError('');
    setFilters(draftFilters);
    setFilterPanelOpen(false);
  };

  const rangeLabel = useMemo(() => formatFiltersLabel(filters), [filters]);

  return (
    <div className="admin-statistics">
      <div className="admin-statistics-header">
        <div>
          <h2 className="admin-statistics-title">Statistics</h2>
          {rangeLabel && <p className="admin-statistics-subtitle">Showing data for {rangeLabel}</p>}
        </div>
        <div className="admin-statistics-actions">
          <select
            className="statistics-select"
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value)}
          >
            <option value="statistics">Statistics Case</option>
            <option value="total">Total Case</option>
          </select>
          <button type="button" className="filter-button" onClick={handleOpenFilter} aria-expanded={filterPanelOpen}>
            <span className="sr-only">Adjust range filter</span>
            <svg className="filter-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.586a2 2 0 0 1-.586 1.414l-4.828 4.828A2 2 0 0 0 14 14.242V19l-4 2v-6.758a2 2 0 0 0-.586-1.414L4.586 9A2 2 0 0 1 4 7.586z"
                fill="currentColor"
              />
            </svg>
          </button>
          {filterPanelOpen && (
            <div className="filter-panel" role="dialog" aria-label="Statistics filters">
              <h4>Filter range</h4>
              <div className="filter-section">
                <label className="filter-radio">
                  <input
                    type="radio"
                    name="filter-mode"
                    value={FILTER_MODES.YEAR}
                    checked={draftFilters.mode === FILTER_MODES.YEAR}
                    onChange={() => {
                      setFilterError('');
                      setDraftFilters((prev) => ({
                        ...prev,
                        mode: FILTER_MODES.YEAR,
                      }));
                    }}
                  />
                  Full year
                </label>
                <label className="filter-radio">
                  <input
                    type="radio"
                    name="filter-mode"
                    value={FILTER_MODES.RANGE}
                    checked={draftFilters.mode === FILTER_MODES.RANGE}
                    onChange={() => {
                      setFilterError('');
                      setDraftFilters((prev) => ({
                        ...prev,
                        mode: FILTER_MODES.RANGE,
                      }));
                    }}
                  />
                  Custom month range
                </label>
              </div>
              {draftFilters.mode === FILTER_MODES.YEAR ? (
                <div className="filter-section">
                  <label htmlFor="year-select" className="filter-label">
                    Year
                  </label>
                  <select
                    id="year-select"
                    value={draftFilters.year}
                    onChange={(event) => {
                      const nextYear = Number(event.target.value);
                      setDraftFilters((prev) => ({
                        ...prev,
                        year: nextYear,
                        startMonth: `${nextYear}-01`,
                        endMonth: `${nextYear}-12`,
                      }));
                    }}
                  >
                    {availableYears.map((year) => (
                      <option value={year} key={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="filter-section filter-section-range">
                  <div>
                    <label htmlFor="start-month" className="filter-label">
                      Start month
                    </label>
                    <input
                      id="start-month"
                      type="month"
                      value={draftFilters.startMonth}
                      max={draftFilters.endMonth}
                      onChange={(event) => {
                        setFilterError('');
                        setDraftFilters((prev) => ({
                          ...prev,
                          startMonth: event.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="end-month" className="filter-label">
                      End month
                    </label>
                    <input
                      id="end-month"
                      type="month"
                      value={draftFilters.endMonth}
                      min={draftFilters.startMonth}
                      onChange={(event) => {
                        setFilterError('');
                        setDraftFilters((prev) => ({
                          ...prev,
                          endMonth: event.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>
              )}
              {filterError && <p className="filter-error">{filterError}</p>}
              <div className="filter-actions">
                <button type="button" className="btn btn-primary" onClick={handleApplyFilters}>
                  Apply
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setFilterError('');
                    setFilterPanelOpen(false);
                    setDraftFilters(filters);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="admin-statistics-card">
        <div className="admin-statistics-card-header">
          <h3>{viewMode === 'statistics' ? 'Statistics Case' : 'Total Case'}</h3>
        </div>

        {viewMode === 'statistics' && (
          <div className="category-selector">
            {CATEGORY_OPTIONS.map((category) => {
              const checked = selectedCategories.includes(category);
              return (
                <button
                  type="button"
                  key={category}
                  className={`category-pill${checked ? ' active' : ''}`}
                  aria-pressed={checked}
                  onClick={() => handleCategoryToggle(category)}
                >
                  <span>{category}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="chart-container">
          {loading && <div className="chart-placeholder">Loading statistics…</div>}
          {!loading && error && <div className="chart-placeholder error">{error}</div>}
          {!loading && !error && viewMode === 'statistics' && selectedCategories.length === 0 && (
            <div className="chart-placeholder">Select at least one category to display.</div>
          )}
          {!loading && !error && viewMode === 'statistics' && selectedCategories.length > 0 && !hasAnyData && (
            <div className="chart-placeholder">No cases found for the selected categories in this period.</div>
          )}
          {!loading && !error && viewMode === 'total' && !hasAnyData && (
            <div className="chart-placeholder">No cases found for this period.</div>
          )}
          {!loading && !error && hasAnyData && (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="#f1e6f7" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#777', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#ddd' }} />
                <YAxis allowDecimals={false} tick={{ fill: '#777', fontSize: 12 }} axisLine={{ stroke: '#ddd' }} />
                <Tooltip />
                <Legend />
                {viewMode === 'statistics'
                  ? selectedCategories.map((category) => (
                      <Line
                        key={category}
                        type="monotone"
                        dataKey={category}
                        stroke={CATEGORY_COLORS[category]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))
                  : (
                    <Line
                      type="monotone"
                      dataKey="Total"
                      stroke={CATEGORY_COLORS.Total}
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                  )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminStatistics;
