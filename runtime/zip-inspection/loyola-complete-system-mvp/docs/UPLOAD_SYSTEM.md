# Upload System

The upload system uses this structure:

```txt
uploads/
  original/
  optimized/
  thumbs/
  documents/
  videos/
  staff/
  website/
  edutrack/
  private/
```

Rules:

- Original file is always preserved
- Optimized images are generated when possible
- Thumbnails are generated when possible
- Metadata is stored in `media_files`
- Private files are protected by backend routes
- Never expose private direct URLs
