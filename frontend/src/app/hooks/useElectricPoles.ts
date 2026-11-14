import { useEffect, useState } from "react";
import { fetchElectricPoles, type ElectricPole } from "../../api/electricPoles";

export function useElectricPoles() {
    const [electricPoles, setElectricPoles] = useState<ElectricPole[]>([]);
    const [electricPolesVersion, setElectricPolesVersion] = useState(0);

    useEffect(() => {
        let active = true;
        fetchElectricPoles()
            .then((poles) => {
                if (active) setElectricPoles(poles);
            })
            .catch((error: unknown) => {
                if (active) console.error("[electric-poles] fetch error:", error);
            });
        return () => {
            active = false;
        };
    }, [electricPolesVersion]);

    const refreshPoles = () => setElectricPolesVersion((v) => v + 1);

    return { electricPoles, refreshPoles };
}