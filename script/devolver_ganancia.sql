DELIMITER //

CREATE TRIGGER `devolver_ganancia` 
AFTER UPDATE ON `retiros` 
FOR EACH ROW 
BEGIN
    -- Verificamos si el estado cambió exactamente de PENDING a REJECTED
    IF NEW.ESTADO_RECLAMO = 'REJECTED' AND OLD.ESTADO_RECLAMO = 'PENDING' THEN 
        
        -- Sumamos el valor devuelto al saldo actual que tenga la ganancia
        UPDATE ganancia  
        SET DISPONIBLE_RETIRAR = DISPONIBLE_RETIRAR + OLD.VALOR
        WHERE IDGANANCIA = OLD.IDGANANCIA;
        
        -- 2. Liberar los pedidos asociados en el JSON
        -- Asumiendo que RECLAMADO es un booleano (TINYINT), usamos 0 (false)
        UPDATE pedidos
        SET RECLAMADO = 0
        WHERE JSON_CONTAINS(OLD.PEDIDOS, JSON_QUOTE(NUMERO_PEDIDO));
        
    END IF;
END //

DELIMITER ;