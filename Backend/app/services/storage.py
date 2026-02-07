import os
from supabase import create_client, Client

class StorageService:
    def __init__(self):
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_KEY")
        
        if not url or not key:
            print("Warning: Supabase credentials not found in environment variables.")
            self.supabase: Client = None
        else:
            self.supabase: Client = create_client(url, key)

    def upload_file(self, bucket: str, path: str, file_content: bytes, content_type: str = "application/pdf") -> str:
        """Uploads a file to Supabase Storage and returns the public URL."""
        if not self.supabase:
            raise Exception("Supabase client not initialized")

        try:
            # Overwrite if exists logic can be handled by remove then upload, or upsert if supported
            # user requests "upload another in place of the previous one", so we try upsert logic
            # upsert=True is supported in some client versions, or we explicitly delete first
            
            # Using upsert options
            self.supabase.storage.from_(bucket).upload(
                path=path,
                file=file_content,
                file_options={"content-type": content_type, "upsert": "true"}
            )
            
            # Get public URL
            # Note: For private buckets, we should use create_signed_url instead.
            # Assuming public for resumes for now as per requirement "return file URL or signed URL"
            # If bucket is private, this returns a public URL that might not work without RLS policies allowing it
            # Let's try to get a signed URL for safety if public fails, or just public if configured.
            
            # Strategy: Return the path, let the frontend/backend generate signed URLs as needed
            # But the requirement asks to return the URL.
            
            return self.supabase.storage.from_(bucket).get_public_url(path)

        except Exception as e:
            print(f"Supabase upload failed: {e}")
            raise e

    def get_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        if not self.supabase:
            raise Exception("Supabase client not initialized")
        
        try:
           res = self.supabase.storage.from_(bucket).create_signed_url(path, expires_in)
           return res["signedURL"]
        except Exception as e:
            print(f"Failed to sign URL: {e}")
            return ""

storage_service = StorageService()
