import { OrderByOption } from "@/constants/orderBy";
import React, { useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";

// todo: remove modal and use better component

interface OrderByRowProps {
  orderOptions: {
    key: OrderByOption;
    label: string;
  }[];
  localOrderBy: OrderByOption;
  localOrderDirection: "asc" | "desc";
  onOrderByChange?: (val: OrderByOption) => void;
  onOrderDirectionChange?: (val: "asc" | "desc") => void;
  onRandomReseed?: () => void;
}

export function OrderByRow({
  orderOptions,
  localOrderBy,
  localOrderDirection,
  onOrderByChange,
  onOrderDirectionChange,
  onRandomReseed,
}: OrderByRowProps) {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<View>(null);

  const toggleDropdown = () => {
    if (!dropdownOpen && buttonRef.current) {
      buttonRef.current.measure((_x, _y, width, height, pageX, pageY) => {
        setDropdownPos({ top: pageY + height + 4, left: pageX, width });
        setDropdownOpen(true);
      });
    } else {
      setDropdownOpen(false);
    }
  };

  const handleDirectionChange = () => {
    const newDir = localOrderDirection === "asc" ? "desc" : "asc";
    if (onOrderDirectionChange) onOrderDirectionChange(newDir);
  };

  const handleOrderByChange = (key: OrderByOption) => {
    if (onOrderByChange) onOrderByChange(key);
    setDropdownOpen(false);
  };

  return (
    <View style={styles.filterRow}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <View style={styles.iconContainer}>
          <Icon
            name="sort"
            size={20}
            color={palette.foreground}
            style={styles.icon}
          />
        </View>
        <Text style={styles.filterLabel}>Order By:</Text>
        <View style={{ flex: 1 }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          {/* Direction arrow or Reseed button */}
          {localOrderBy === "random" ? (
            <TouchableOpacity
              style={styles.orderDirectionButton}
              onPress={() => onRandomReseed && onRandomReseed()}
              accessibilityLabel="Reseed random order"
            >
              <Icon
                name="refresh"
                size={18}
                color={palette.foreground}
                style={{ marginLeft: 6, opacity: 0.7 }}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.orderDirectionButton}
              onPress={handleDirectionChange}
              accessibilityLabel="Toggle order direction"
            >
              <Icon
                name={
                  localOrderDirection === "asc"
                    ? "arrow-upward"
                    : "arrow-downward"
                }
                size={18}
                color={palette.foreground}
                style={{ marginLeft: 6, opacity: 0.7 }}
              />
            </TouchableOpacity>
          )}
          {/* Dropdown selector */}
          <View style={styles.orderDropdownContainer}>
            <TouchableOpacity
              ref={buttonRef}
              style={styles.orderDropdownButton}
              onPress={toggleDropdown}
              accessibilityLabel="Select order by option"
            >
              <Text style={[styles.segmentLabel, { paddingLeft: 6 }]}>
                {orderOptions.find((opt) => opt.key === localOrderBy)?.label}
              </Text>
              <Icon
                name={dropdownOpen ? "expand-less" : "expand-more"}
                size={18}
                color={palette.foreground}
                style={{ marginLeft: 4, opacity: 0.7 }}
              />
            </TouchableOpacity>
          </View>
          <Modal
            visible={dropdownOpen}
            transparent
            animationType="none"
            onRequestClose={() => setDropdownOpen(false)}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setDropdownOpen(false)}
            >
              <View
                style={[
                  styles.orderDropdownMenu,
                  {
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                  },
                ]}
              >
                {orderOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.orderDropdownItem,
                      localOrderBy === opt.key &&
                        styles.orderDropdownItemActive,
                    ]}
                    onPress={() => handleOrderByChange(opt.key)}
                  >
                    <Text
                      style={[
                        styles.segmentLabel,
                        localOrderBy === opt.key && styles.segmentLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      </View>
    </View>
  );
}

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 4,
      justifyContent: "space-between",
    },
    iconContainer: {
      width: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    icon: {
      marginRight: 8,
    },
    filterLabel: {
      fontSize: fontSizes.body,
      color: palette.foreground,
      marginRight: 8,
      fontWeight: "500",
    },
    orderDirectionButton: {
      borderRadius: 6,
      backgroundColor: "transparent",
    },
    orderDropdownContainer: {
      marginLeft: 6,
    },
    orderDropdownButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.backgroundMidLight,
      borderRadius: 8,
      paddingVertical: 4,
      borderColor: palette.border,
    },
    segmentLabel: {
      fontSize: fontSizes.body,
      color: palette.foreground,
      width: 90,
    },
    segmentLabelActive: {
      fontWeight: "bold",
    },
    modalBackdrop: {
      flex: 1,
    },
    orderDropdownMenu: {
      position: "absolute",
      backgroundColor: palette.backgroundMidLight,
      borderRadius: 8,
      elevation: 10,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 6,
    },
    orderDropdownItem: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    orderDropdownItemActive: {
      backgroundColor: palette.border,
    },
  });
}
