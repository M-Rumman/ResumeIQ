object DeleteComponent: TDeleteComponent
  Left = 0
  Top = 0
  Caption = 'DeleteComponent'
  ClientHeight = 724
  ClientWidth = 1106
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  WindowState = wsMaximized
  TextHeight = 15
  object Delete: TButton
    Left = 616
    Top = 360
    Width = 75
    Height = 25
    Caption = 'Delete'
    TabOrder = 0
    OnClick = DeleteClick
  end
  object ID: TEdit
    Left = 544
    Top = 296
    Width = 209
    Height = 23
    TabOrder = 1
    Text = 'ID'
  end
end
