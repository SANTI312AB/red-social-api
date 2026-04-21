DELIMITER $$

CREATE TRIGGER `actualizar_stock_despues_de_rechazado` AFTER UPDATE ON `ventas`
FOR EACH ROW
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE detalle_producto_id INT;
    DECLARE detalle_variacion_id INT;
    DECLARE cantidad_pedida INT;

    -- Cursor: Obtiene los productos de la venta a través de la relación con pedidos
    DECLARE cur CURSOR FOR
        SELECT 
            d.IDPRODUCTO, 
            d.IDVARIACION, 
            IFNULL(d.CANTIDAD, 0) -- Blindaje 1: Si cantidad es null, usar 0
        FROM detalle_pedido d
        INNER JOIN pedidos p ON p.IDPEDIDO = d.IDPEDIDO 
        WHERE p.IDVENTA = NEW.IDVENTA;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    -- Solo ejecutamos si el estado cambia a RECHAZADO (29) o CANCELADO (31)
    -- Y si no estaba ya en uno de esos estados (para evitar duplicar stock)
    IF (NEW.IDESTADO_PAGO = 29 OR NEW.IDESTADO_PAGO = 31) 
       AND (OLD.IDESTADO_PAGO <> 29 AND OLD.IDESTADO_PAGO <> 31) THEN
        
        OPEN cur;

        read_loop: LOOP
            FETCH cur INTO detalle_producto_id, detalle_variacion_id, cantidad_pedida;

            IF done THEN
                LEAVE read_loop;
            END IF;

            -- Si la cantidad pedida es mayor a 0, procedemos
            IF cantidad_pedida > 0 THEN
                
                IF detalle_variacion_id IS NOT NULL THEN
                    -- Restaurar stock a la VARIANTE
                    -- Blindaje 2: IFNULL(CANTIDAD_VARIACION, 0) asegura que si el stock era NULL, empiece en 0
                    UPDATE variaciones
                    SET CANTIDAD_VARIACION = IFNULL(CANTIDAD_VARIACION, 0) + cantidad_pedida
                    WHERE IDVARIACION = detalle_variacion_id;
                ELSE
                    -- Restaurar stock al PRODUCTO base
                    -- Blindaje 2 aplicado aquí también
                    UPDATE productos
                    SET CANTIDAD_PRODUCTO = IFNULL(CANTIDAD_PRODUCTO, 0) + cantidad_pedida
                    WHERE IDPRODUCTO = detalle_producto_id;
                END IF;

            END IF;

        END LOOP;

        CLOSE cur;
    END IF;
END$$

DELIMITER ;