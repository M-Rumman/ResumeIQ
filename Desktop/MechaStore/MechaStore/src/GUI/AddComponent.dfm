object AddComponentPortal: TAddComponentPortal
  Left = 0
  Top = 0
  Caption = 'AddComponentPortal'
  ClientHeight = 610
  ClientWidth = 1107
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  TextHeight = 15
  object edtDesc: TEdit
    Left = 474
    Top = 168
    Width = 199
    Height = 23
    TabOrder = 0
    Text = 'edtDesc'
    OnChange = edtDescChange
  end
  object edtPrice: TEdit
    Left = 474
    Top = 216
    Width = 199
    Height = 23
    TabOrder = 1
    Text = 'edtPrice'
    OnChange = edtPriceChange
  end
  object edtQty: TEdit
    Left = 474
    Top = 264
    Width = 199
    Height = 23
    TabOrder = 2
    Text = 'edtQty'
    OnChange = edtQtyChange
  end
  object edtSeller: TEdit
    Left = 474
    Top = 312
    Width = 199
    Height = 23
    TabOrder = 3
    Text = 'edtSeller'
    OnChange = edtSellerChange
  end
  object edtPhone: TEdit
    Left = 474
    Top = 360
    Width = 199
    Height = 23
    TabOrder = 4
    Text = 'edtPhone'
    OnChange = edtPhoneChange
  end
  object btnAdd: TButton
    Left = 520
    Top = 448
    Width = 75
    Height = 25
    Caption = 'btnAdd'
    TabOrder = 5
    OnClick = btnAddClick
  end
  object edtName: TEdit
    Left = 474
    Top = 128
    Width = 199
    Height = 23
    TabOrder = 6
    Text = 'edtName'
    OnChange = edtNameChange
  end
end
