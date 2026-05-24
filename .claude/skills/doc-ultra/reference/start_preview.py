"""Quick preview launcher."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from md_easy_view.preview import PreviewServer

if __name__ == "__main__":
    md_file = Path(r"d:\all-in-mvp\MVP白皮书最终融合版.md")
    server = PreviewServer(
        work_dir=md_file.parent,
        port=8765,
        original_file=md_file,
        open_browser=True,
        mode="file",
    )
    print(f"Starting preview on http://127.0.0.1:8765 ...")
    server.start()
    server.wait()
