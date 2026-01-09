object AdminDashboardForm: TAdminDashboardForm
  Left = 0
  Top = 0
  Caption = 'AdminDashboardForm'
  ClientHeight = 728
  ClientWidth = 1105
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clDarkseagreen
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  WindowState = wsMaximized
  TextHeight = 15
  object Admin_Dashboard: TLabel
    Left = 432
    Top = 128
    Width = 267
    Height = 45
    Caption = 'Admin_Dashboard'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clDarkseagreen
    Font.Height = -33
    Font.Name = 'Segoe UI'
    Font.Style = []
    ParentFont = False
  end
  object Browse: TButton
    Left = 504
    Top = 208
    Width = 129
    Height = 33
    Caption = 'Browse'
    TabOrder = 0
    OnClick = BrowseClick
  end
  object AddComponent: TButton
    Left = 504
    Top = 256
    Width = 129
    Height = 33
    Caption = 'AddComponent'
    TabOrder = 1
    OnClick = AddComponentClick
  end
  object UpdateComponent: TButton
    Left = 504
    Top = 304
    Width = 129
    Height = 33
    Caption = 'UpdateComponent'
    TabOrder = 2
    OnClick = UpdateComponentClick
  end
  object DeleteComponent: TButton
    Left = 504
    Top = 352
    Width = 129
    Height = 33
    Caption = 'DeleteComponent'
    TabOrder = 3
    OnClick = DeleteComponentClick
  end
  object Users: TButton
    Left = 504
    Top = 400
    Width = 129
    Height = 33
    Caption = 'Users'
    TabOrder = 4
    OnClick = UsersClick
  end
  object Orders: TButton
    Left = 504
    Top = 448
    Width = 129
    Height = 33
    Caption = 'Orders'
    TabOrder = 5
    OnClick = OrdersClick
  end
  object Exit: TButton
    Left = 504
    Top = 504
    Width = 129
    Height = 33
    Caption = 'Exit'
    TabOrder = 6
    OnClick = ExitClick
  end
end
