import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { palette } from "@/constants/Colors";
import { fontSizes } from "@/constants/typography";

interface OrderByRowProps {
  orderOptions: { key: string; label: string }[];
  localOrderBy: string;
  localOrderDirection: "asc" | "desc";
  onOrderByChange?: (val: string) => void;
  onOrderDirectionChange?: (val: "asc" | "desc") => void;
}

interface OrderByRowState {
  dropdownOpen: boolean;
}

export class OrderByRow extends React.Component<
  OrderByRowProps,
  OrderByRowState
> {
  state: OrderByRowState = {
    dropdownOpen: false,
  };

  toggleDropdown = () => {
    this.setState((prev) => ({ dropdownOpen: !prev.dropdownOpen }));
  };

  handleDirectionChange = () => {
    const newDir = this.props.localOrderDirection === "asc" ? "desc" : "asc";
    if (this.props.onOrderDirectionChange)
      this.props.onOrderDirectionChange(newDir);
  };

  handleOrderByChange = (key: string) => {
    if (this.props.onOrderByChange) this.props.onOrderByChange(key);
    this.setState({ dropdownOpen: false });
  };

  render() {
    const { orderOptions, localOrderBy, localOrderDirection } = this.props;
    const { dropdownOpen } = this.state;
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
            {/* Direction arrow */}
            <TouchableOpacity
              style={styles.orderDirectionButton}
              onPress={this.handleDirectionChange}
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
            {/* Dropdown selector */}
            <View style={styles.orderDropdownContainer}>
              <TouchableOpacity
                style={styles.orderDropdownButton}
                onPress={this.toggleDropdown}
                accessibilityLabel="Select order by option"
              >
                <Text style={[styles.segmentLabel]}>
                  {orderOptions.find((opt) => opt.key === localOrderBy)?.label}
                </Text>
                <Icon
                  name={dropdownOpen ? "expand-less" : "expand-more"}
                  size={18}
                  color={palette.foreground}
                  style={{ marginLeft: 4, opacity: 0.7 }}
                />
              </TouchableOpacity>
              {dropdownOpen && (
                <View style={styles.orderDropdownMenu}>
                  {orderOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.orderDropdownItem,
                        localOrderBy === opt.key &&
                          styles.orderDropdownItemActive,
                      ]}
                      onPress={() => this.handleOrderByChange(opt.key)}
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
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
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
    position: "relative",
    marginLeft: 6,
    marginRight: 7,
  },
  orderDropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.backgroundMidLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  segmentLabel: {
    fontSize: fontSizes.body,
    color: palette.foreground,
  },
  segmentLabelActive: {
    fontWeight: "bold",
  },
  orderDropdownMenu: {
    position: "absolute",
    top: 38,
    left: 0,
    right: 0,
    backgroundColor: palette.backgroundMidLight,
    borderRadius: 8,
    elevation: 6,
    zIndex: 999,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
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
