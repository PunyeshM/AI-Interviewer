import hashlib
import time
import os
from typing import Dict, Any

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

def generate_signature(params: Dict[str, Any]) -> str:
    """
    Generate Cloudinary signature for signed uploads.
    params: dict of parameters to sign (timestamp, etc.)
    """
    if not CLOUDINARY_API_SECRET:
        raise ValueError("CLOUDINARY_API_SECRET not set")

    # Sort parameters by key
    sorted_params = sorted(params.items())
    
    # Create string: key=value&key=value...
    string_to_sign = "&".join([f"{k}={v}" for k, v in sorted_params])
    
    # Append secret
    string_to_sign += CLOUDINARY_API_SECRET
    
    # SHA1 hash
    return hashlib.sha1(string_to_sign.encode('utf-8')).hexdigest()

def get_upload_signature(folder: str = "interviews") -> Dict[str, Any]:
    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
    }
    signature = generate_signature(params)
    return {
        "timestamp": timestamp,
        "folder": folder,
        "signature": signature,
        "api_key": CLOUDINARY_API_KEY,
        "cloud_name": CLOUDINARY_CLOUD_NAME
    }
