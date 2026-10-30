import { ReactPhotoSphereViewer } from "react-photo-sphere-viewer";
import { API_BASE } from "../../config";

export default function TestPSV() {
    return (
        <div style={{ width: "100vw", height: "100vh" }}>
            <ReactPhotoSphereViewer
                src={`${API_BASE}/panoramas/demo1.png`}
                height="100vh"
                width="100%"
            />
        </div>
    );
}