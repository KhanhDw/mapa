import { ReactPhotoSphereViewer } from "react-photo-sphere-viewer";

export default function TestPSV() {
    return (
        <div style={{ width: "100vw", height: "100vh" }}>
            <ReactPhotoSphereViewer
                src="http://127.0.0.1:8000/panoramas/demo1.png"
                height="100vh"
                width="100%"
            />
        </div>
    );
}