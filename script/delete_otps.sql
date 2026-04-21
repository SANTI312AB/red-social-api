DELIMITER $$

CREATE EVENT IF NOT EXISTS limpiar_otps_vencidos
ON SCHEDULE EVERY 1 HOUR -- Frecuencia: Cada hora
STARTS CURRENT_TIMESTAMP -- Empieza a correr desde ahora mismo
ON COMPLETION PRESERVE   -- El evento no se borra después de ejecutarse
DO
BEGIN
    DELETE FROM opt 
    WHERE 
        USADO = 1                -- Borrar si ya fue usado
        OR 
        expiresAt < NOW();       -- O borrar si la fecha de expiración ya pasó
END$$

DELIMITER ;