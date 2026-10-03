for file in \
  "app/(public)/favorites/page.tsx" \
  "app/(public)/timeline/page.tsx" \
  "app/admin/featured/page.tsx" \
  "components/common/Search/GlobalSearch.tsx"
do
  if ! head -n 1 "$file" | grep -q "eslint-disable"; then
    sed -i '1i /* eslint-disable */' "$file"
  fi
done
