# Vulnews - Persistent Results & Periodic Update Tasks

## Goal
Implement a save/reload/update functionality so the app stores vulnerability results after the first visit, loads from cache on subsequent visits, and only updates periodically if new findings are found via the API.

## Tasks

1. **Design Data Storage Structure**
   - Decide on localStorage key(s) and data format for cached results and metadata (timestamp, filters, etc).

2. **Cache Results After Fetch**
   - After a successful API fetch, store the results and relevant metadata in localStorage.

3. **Load from Cache on Startup**
   - On app init, check localStorage for cached results.
   - If present and not expired, load and render from cache immediately.
   - If not present or expired, fetch from API as usual.

4. **Implement Periodic Update Logic**
   - Define an update interval (e.g., 30 minutes, 1 hour).
   - On app load, if cache is older than interval, trigger a background fetch.
   - If new results are found (i.e., new vulnerabilities not in cache), update cache and UI.

5. **UI Feedback for Data Source**
   - Indicate in the UI if data is loaded from cache or freshly fetched.
   - Optionally, show last update time and a manual refresh button.

6. **Handle Filter/Search Consistency**
   - Ensure cached results are compatible with current filters/search.
   - If filters change, may need to re-fetch or re-filter cached data.

7. **Testing & Edge Cases**
   - Test with no cache, fresh cache, expired cache, and after new findings are published.
   - Handle localStorage quota errors gracefully.

---

- [ ] 1. Design data storage structure
- [ ] 2. Cache results after fetch
- [ ] 3. Load from cache on startup
- [ ] 4. Implement periodic update logic
- [ ] 5. UI feedback for data source
- [ ] 6. Handle filter/search consistency
- [ ] 7. Testing & edge cases
