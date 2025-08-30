interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onSettingsOpen: () => void;
}

export default function Sidebar({ activeSection, onSectionChange, onSettingsOpen }: SidebarProps) {
  const menuItems = [
    { id: "email-sender", label: "Email Sender", icon: "📧" },
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "templates", label: "Templates", icon: "📄" },
    { id: "history", label: "History", icon: "🕒" },
  ];

  return (
    <div className="w-45 bg-dark-surface-2 border-r border-dark-border p-2 flex flex-col">
      {/* Logo Section */}
      <div className="flex items-center mb-3">
        <div className="w-8 h-8 bg-red-primary flex items-center justify-center font-bold text-white mr-2 text-sm">
          V6
        </div>
        <span className="text-dark-text font-semibold text-sm">Sender</span>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1">
        <ul className="space-y-1.5">
          {menuItems.map((item) => (
            <li 
              key={item.id}
              className={`nav-item px-2.5 py-2 rounded cursor-pointer flex items-center transition-colors ${
                activeSection === item.id 
                  ? 'bg-red-primary text-white' 
                  : 'text-dark-text hover:bg-red-primary hover:text-white'
              }`}
              onClick={() => onSectionChange(item.id)}
              data-testid={`nav-${item.id}`}
            >
              <span className="mr-2">{item.icon}</span>
              <span>{item.label}</span>
            </li>
          ))}
          <li 
            className="nav-item text-dark-text hover:bg-red-primary hover:text-white px-2.5 py-2 rounded cursor-pointer flex items-center transition-colors"
            onClick={onSettingsOpen}
            data-testid="nav-settings"
          >
            <span className="mr-2">⚙️</span>
            <span>Settings</span>
          </li>
        </ul>
      </nav>
    </div>
  );
}
