import sys
from pyngrok import ngrok, conf

# Verify port
PORT = 5000

def main():
    print("="*60)
    print("NGROK TUNNEL SETUP")
    print("="*60)

    # 1. Get Auth Token
    # Check if a token is stored, or ask for one
    config = conf.get_default()
    if not config.auth_token:
        print("\nExisting auth token not found.")
        print("Please paste your Ngrok Authtoken below.")
        print("(Get it from https://dashboard.ngrok.com/get-started/your-authtoken)")
        token = input("\nNgrok Authtoken: ").strip()
        if token:
            ngrok.set_auth_token(token)
            print("Token saved!")
        else:
            print("No token provided. Exiting.")
            return

    # 2. Start Tunnel
    # Force IPv4 127.0.0.1 to avoid IPv6 issues
    target = f"127.0.0.1:{PORT}"
    print(f"\nStarting tunnel to http://{target}...")
    try:
        # Create tunnel
        public_url = ngrok.connect(target).public_url
        
        print("\n" + "="*60)
        print(f"🎉 SUCCESS! Your app is online at:")
        print(f"   {public_url}")
        print("="*60)
        print("\n -> Send this URL to your phone")
        print(" -> Press CTRL+C to stop")
        
        # Keep alive
        ngrok_process = ngrok.get_ngrok_process()
        ngrok_process.proc.wait()
        
    except Exception as e:
        print(f"\n❌ Error starting ngrok: {e}")
        print("Make sure your Flask server is running in another terminal!")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopping ngrok...")
        ngrok.kill()
