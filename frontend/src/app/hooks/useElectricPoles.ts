
import { useCallback, useEffect, useState } from "react";
import {
    getElectricPoles,
    type ElectricPole,
} from "../../features/electric-poles/api/electricPoles";

export function useElectricPoles() {
    const [electricPoles, setElectricPoles] = useState<ElectricPole[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [electricPolesVersion, setElectricPolesVersion] = useState(0);

    useEffect(() => {
        let active = true;

        const loadElectricPoles = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await getElectricPoles();

                if (active) {
                    setElectricPoles(response.items);
                }
            } catch (err: unknown) {
                if (active) {
                    setError(err);
                    console.error("[electric-poles] fetch error:", err);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadElectricPoles();

        return () => {
            active = false;
        };
    }, [electricPolesVersion]);

    const refreshPoles = useCallback(() => {
        setElectricPolesVersion((v) => v + 1);
    }, []);

    return {
        electricPoles,
        loading,
        error,
        refreshPoles,
    };
}
