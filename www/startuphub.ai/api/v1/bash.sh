curl "https://www.startuphub.ai/api/v1/startups?q=anthropic&limit=5" -H "Authorization: Bearer sk_live_your_key_here"

 curl -G "https://www.startuphub.ai/api/v1/startups" \
  -H "Authorization: Bearer sk_live_..." \
  --data-urlencode "country=Israel" \
  --data-urlencode "sector=Cybersecurity" \
  --data-urlencode "founded_after=2026-07-01" \
  --data-urlencode "sort=created_at.desc" \
  --data-urlencode "limit=50"

  curl -G "https://www.startuphub.ai/api/v1/startups" \
  -H "Authorization: Bearer sk_live_..." \
  --data-urlencode "country=Canada" \
  --data-urlencode "sector=Artificial Intelligence" \
  --data-urlencode "sort=created_at.desc" \
  --data-urlencode "founded_after=2026-06-01" \
  --data-urlencode "limit=100"
  
# Stealth AI on .ai / .io with verified founder emails
Requires Pro Lite+ for stealth=true and has_known_emails=true.

CURL
curl -G "https://www.startuphub.ai/api/v1/startups" \
  -H "Authorization: Bearer sk_live_..." \
  --data-urlencode "stealth=true" \
  --data-urlencode "domain_tld=ai,io" \
  --data-urlencode "has_known_emails=true" \
  --data-urlencode "sort=created_at.desc"
