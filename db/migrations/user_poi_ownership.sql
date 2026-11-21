BEGIN;

-- 1. Bảo đảm không có POI không xác định chủ sở hữu
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM user_data.pois
        WHERE user_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Cannot migrate: user_data.pois contains NULL user_id';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM user_data.pois p
        LEFT JOIN public.users u ON u.id = p.user_id
        WHERE u.id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Cannot migrate: user_data.pois contains invalid user_id';
    END IF;
END $$;

-- 2. Bắt buộc mọi User POI phải có chủ sở hữu
ALTER TABLE user_data.pois
    ALTER COLUMN user_id SET NOT NULL;

-- 3. Thay đổi chính sách xóa tài khoản
ALTER TABLE user_data.pois
    DROP CONSTRAINT pois_user_id_fkey;

ALTER TABLE user_data.pois
    ADD CONSTRAINT pois_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE RESTRICT;

COMMIT;