-- Enum values for physical closures (mufas) and mufa route points.
-- Kept separate so following migrations can safely use the new enum values.

ALTER TYPE element_type ADD VALUE IF NOT EXISTS 'closure';
ALTER TYPE route_point_type ADD VALUE IF NOT EXISTS 'mufa';
